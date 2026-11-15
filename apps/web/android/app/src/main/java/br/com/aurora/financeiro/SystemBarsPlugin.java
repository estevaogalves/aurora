package br.com.aurora.financeiro;

import android.graphics.Color;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Pinta as barras do sistema (hora/bateria e navegação) e o fundo atrás do app na cor do tema, com ícones claros ou escuros. */
@CapacitorPlugin(name = "SystemBars")
public class SystemBarsPlugin extends Plugin {
    @PluginMethod
    public void set(PluginCall call) {
        final String color = call.getString("color", "#0D1017");
        final boolean light = Boolean.TRUE.equals(call.getBoolean("light", false));
        getActivity().runOnUiThread(() -> {
            try {
                int c = Color.parseColor(color);
                Window window = getActivity().getWindow();
                window.setStatusBarColor(c);
                window.setNavigationBarColor(c);
                window.getDecorView().setBackgroundColor(c);
                WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
                // fundo claro pede ícones escuros e vice-versa
                controller.setAppearanceLightStatusBars(light);
                controller.setAppearanceLightNavigationBars(light);
                call.resolve();
            } catch (Exception e) {
                call.reject("cor inválida");
            }
        });
    }
}
