package br.com.aurora.financeiro;

import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/**
 * Recebe um arquivo (CSV ou OFX) enviado ao Aurora por "Compartilhar" ou "Abrir com" (ex.: anexo do Gmail) e o entrega
 * ao app web. O arquivo é lido na hora e fica só na memória até o app web buscá-lo; nada é gravado em disco.
 */
@CapacitorPlugin(name = "SharedFile")
public class SharedFilePlugin extends Plugin {
    /** Mesmo teto do importador (2 MB): acima disso o app web avisa em vez de tentar ler. */
    private static final int MAX_BYTES = 2 * 1024 * 1024;

    private static JSObject pending;
    private static SharedFilePlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    /** Chamado pela MainActivity a cada intent recebido (abertura do app ou app já aberto). */
    public static void handle(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Uri uri = null;
        if (Intent.ACTION_SEND.equals(action)) {
            uri = Build.VERSION.SDK_INT >= 33
                ? intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class)
                : intent.getParcelableExtra(Intent.EXTRA_STREAM);
        } else if (Intent.ACTION_VIEW.equals(action)) {
            uri = intent.getData();
        }
        if (uri == null) return;
        // o mesmo intent não pode ser tratado de novo (rotação, volta ao app)
        intent.setAction(null);
        pending = read(context.getContentResolver(), uri);
        if (instance != null) instance.notifyListeners("sharedFile", new JSObject());
    }

    private static JSObject read(ContentResolver resolver, Uri uri) {
        JSObject result = new JSObject();
        result.put("has", true);
        result.put("name", displayName(resolver, uri));
        String mime = resolver.getType(uri);
        result.put("mime", mime == null ? "" : mime);
        try (InputStream in = resolver.openInputStream(uri)) {
            if (in == null) throw new IllegalStateException("sem conteúdo");
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int total = 0;
            int n;
            while ((n = in.read(buffer)) != -1) {
                total += n;
                if (total > MAX_BYTES) {
                    result.put("tooLarge", true);
                    return result;
                }
                out.write(buffer, 0, n);
            }
            result.put("data", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
        } catch (Exception e) {
            result.put("error", true);
        }
        return result;
    }

    private static String displayName(ContentResolver resolver, Uri uri) {
        try (Cursor cursor = resolver.query(uri, new String[] {OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                String name = cursor.getString(0);
                if (name != null && !name.isEmpty()) return name;
            }
        } catch (Exception ignored) {
            // sem nome: cai no último trecho do caminho
        }
        String last = uri.getLastPathSegment();
        return last == null ? "arquivo" : last;
    }

    /** O app web busca o arquivo recebido (uma vez só): sem nada pendente, devolve has=false. */
    @PluginMethod
    public void getPending(PluginCall call) {
        JSObject result = pending;
        pending = null;
        if (result == null) {
            result = new JSObject();
            result.put("has", false);
        }
        call.resolve(result);
    }
}
