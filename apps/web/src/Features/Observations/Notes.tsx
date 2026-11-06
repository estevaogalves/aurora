import { useState, useMemo, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { RiFilePaper2Line } from "react-icons/ri";
import { Textarea } from "../../components/ui/textarea";
import { Button } from "../../components/ui/button";
import NotesItem from "./NotesItem";
import { useFinanceStore } from "../../Store/FinanceStore";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "../../components/ui/pagination";
import { showToast } from "../Warnings/ToastContainer";

export default function Notes() {
  const [newNote, setNewNote] = useState("");
  const [page, setPage] = useState(1);

  const NOTES_PER_PAGE = 3;
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const allNotes = useFinanceStore((state) => state.notes);

  const notes = useMemo(() => {
    return allNotes.filter((note) => note.month === currentMonth);
  }, [allNotes, currentMonth]);

  const addNote = useFinanceStore((state) => state.addNote);
  const removeNote = useFinanceStore((state) => state.removeNote);
  const togglePinNote = useFinanceStore((state) => state.togglePinNote);
  const updateNote = useFinanceStore((state) => state.updateNote);

  // 🟢 SEPARAR fixadas e normais
  const pinnedNotes = useMemo(() => {
    return notes.filter((note) => note.pinned);
  }, [notes]);

  const normalNotes = useMemo(() => {
    return notes.filter((note) => !note.pinned);
  }, [notes]);

  // 🟢 FUNÇÃO PARA DISTRIBUIR PÁGINAS COM FIXADAS SEPARADAS
  const getPages = () => {
    const pages = [];
    let remainingPinned = [...pinnedNotes];
    let remainingNormal = [...normalNotes];
    let pageIndex = 0;

    while (remainingPinned.length > 0 || remainingNormal.length > 0) {
      const pagePinned = [];
      const pageNormal = [];

      // 1. Colocar fixadas nesta página (quantas couberem)
      const pinnedSpace = Math.min(remainingPinned.length, NOTES_PER_PAGE);
      if (pinnedSpace > 0) {
        pagePinned.push(...remainingPinned.splice(0, pinnedSpace));
      }

      // 2. Calcular espaço restante para normais
      const remainingSpace = NOTES_PER_PAGE - pagePinned.length;

      // 3. Colocar normais nesta página (se houver espaço)
      if (remainingSpace > 0 && remainingNormal.length > 0) {
        const normalToAdd = Math.min(remainingNormal.length, remainingSpace);
        pageNormal.push(...remainingNormal.splice(0, normalToAdd));
      }

      pages[pageIndex] = {
        pinned: pagePinned,
        normal: pageNormal,
        hasPinned: pagePinned.length > 0,
      };

      pageIndex++;
    }

    return pages;
  };

  const pages = useMemo(() => getPages(), [pinnedNotes, normalNotes]);
  const totalPages = pages.length;
  const currentPage = pages[page - 1] || {
    pinned: [],
    normal: [],
    hasPinned: false,
  };

  // 🟢 Resetar página se ela não existir mais
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
  }, [totalPages, page]);

  const handleSaveNote = () => {
    if (!newNote.trim()) {
      showToast({
        type: "error",
        text: "A nota não pode estar vazia",
      });
      return;
    }

    addNote({
      id: crypto.randomUUID(),
      content: newNote,
      date: new Date().toLocaleDateString("pt-BR"),
      pinned: false,
      month: currentMonth,
    });

    showToast({
      type: "success",
      text: "Nota criada com sucesso",
    });

    setNewNote("");
    setPage(1);
  };

  return (
    <div className="mt-6 space-y-6">
      {/* CARD 1 - Criar nota */}
      <Card className="shadow-xl bg-slate-900 border-slate-600">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="text-2xl px-1.5 py-1.5 rounded-lg bg-amber-950 text-amber-600 border border-amber-600">
              <RiFilePaper2Line />
            </div>
            <section>
              <CardTitle className="text-xl font-sans font-bold text-white">
                Observações Gerais
              </CardTitle>
              <CardDescription className="text-md font-sans font-medium text-gray-300">
                Anote lembretes sobre este mês
              </CardDescription>
            </section>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-2">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Ex: Lembrar de pagar o cartão até dia 15..."
            className="rounded-xl border border-gray-500 !min-h-[120px] text-white placeholder:text-gray-300 placeholder:text-lg !text-lg !font-medium focus:!ring-2 focus:!ring-green-600 focus:!outline-none"
          />

          <section className="text-right">
            <Button
              onClick={handleSaveNote}
              className="w-[150px] mt-2 bg-green-800 hover:bg-green-900 border border-green-600 font-bold px-5 py-3 text-base"
            >
              Salvar
            </Button>
          </section>
        </CardContent>
      </Card>

      {/* CARD 2 - Lista de notas */}
      {notes.length > 0 && (
        <Card className="shadow-xl overflow-hidden bg-slate-900 border-slate-600">
          <CardContent className="p-6 space-y-6">
            {/* HEADER */}
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold text-gray-400">
                  Total: {notes.length} nota{notes.length > 1 ? "s" : ""}
                </p>
                {pinnedNotes.length > 0 && (
                  <p className="text-xs text-emerald-400 mt-1">
                    📌 {pinnedNotes.length} fixada
                    {pinnedNotes.length > 1 ? "s" : ""}
                  </p>
                )}
              </div>
              {totalPages > 1 && (
                <p className="text-sm text-gray-400">
                  Página {page} de {totalPages}
                </p>
              )}
            </div>

            {/* NOTAS FIXADAS DA PÁGINA ATUAL */}
            {currentPage.pinned.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-500 flex items-center gap-2">
                  <span>📌</span> Fixadas
                </p>
                <div className="space-y-3">
                  {currentPage.pinned.map((note) => (
                    <NotesItem
                      key={note.id}
                      id={note.id}
                      content={note.content}
                      date={note.date}
                      pinned={note.pinned}
                      onDelete={removeNote}
                      onTogglePin={togglePinNote}
                      onUpdate={updateNote}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* LINHA DIVISÓRIA (se houver fixadas e normais na mesma página) */}
            {currentPage.pinned.length > 0 && currentPage.normal.length > 0 && (
              <div className="border-t border-gray-700 my-4" />
            )}

            {/* NOTAS NORMAIS DA PÁGINA ATUAL */}
            {currentPage.normal.length > 0 && (
              <div className="space-y-3">
                {currentPage.pinned.length > 0 && (
                  <p className="text-sm font-semibold text-gray-500 flex items-center gap-2">
                    <span>📄</span> Outras
                  </p>
                )}
                <div className="space-y-3">
                  {currentPage.normal.map((note) => (
                    <NotesItem
                      key={note.id}
                      id={note.id}
                      content={note.content}
                      date={note.date}
                      pinned={note.pinned}
                      onDelete={removeNote}
                      onTogglePin={togglePinNote}
                      onUpdate={updateNote}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* PAGINAÇÃO */}
            {totalPages > 1 && (
              <div className="pt-4 border-t border-gray-700">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                        className={`
                          ${
                            page === 1
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer hover:bg-white/10"
                          }
                          text-white font-bold
                        `}
                      />
                    </PaginationItem>

                    {Array.from({ length: totalPages }).map((_, index) => {
                      const pageNumber = index + 1;
                      const isActive = page === pageNumber;
                      const pageHasPinned = pages[index]?.pinned.length > 0;

                      return (
                        <PaginationItem key={pageNumber}>
                          <PaginationLink
                            isActive={isActive}
                            onClick={() => setPage(pageNumber)}
                            className={`
                              cursor-pointer relative
                              ${
                                isActive
                                  ? "bg-green-600 text-white hover:bg-green-700 border-green-600"
                                  : "text-white hover:bg-white/10"
                              }
                            `}
                          >
                            {pageNumber}
                            {pageHasPinned && !isActive && (
                              <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full" />
                            )}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() =>
                          setPage((p) => Math.min(p + 1, totalPages))
                        }
                        className={`
                          ${
                            page === totalPages
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer hover:bg-white/10"
                          }
                          text-white font-bold
                        `}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
