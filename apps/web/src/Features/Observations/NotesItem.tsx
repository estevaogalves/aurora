import { useState } from "react";
import { Card, CardContent } from "../../components/ui/card";
import { FaEdit, FaTrash, FaCheck } from "react-icons/fa";
import { BsPinAngle, BsPinAngleFill } from "react-icons/bs";
import { Textarea } from "../../components/ui/textarea";
import { showToast } from "../Warnings/ToastContainer";

interface NotesItemProps {
  id: string;
  content: string;
  date: string;
  pinned: boolean;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onUpdate: (id: string, content: string) => void;
}

export default function NotesItem({
  id,
  content,
  date,
  pinned,
  onDelete,
  onTogglePin,
  onUpdate,
}: NotesItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [isExpanded, setIsExpanded] = useState(false); // 🟢 NOVO ESTADO

 const handleSaveEdit = () => {
  if (editContent.trim()) {
    onUpdate(id, editContent);

    showToast({
      type: "success",
      text: "Nota atualizada",
    });

    setIsEditing(false);
  }
};

const handleTogglePin = () => {
  onTogglePin(id);

  showToast({
    type: "success",
    text: pinned ? "Nota desfixada" : "Nota fixada",
  });
};

const handleDelete = () => {
  onDelete(id);

  showToast({
    type: "success",
    text: "Nota removida",
  });
};

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const shouldShowButton = content.length > 150;
  const displayContent = isExpanded
    ? content
    : content.slice(0, 150) + (shouldShowButton ? "..." : "");

  return (
    <Card
      className={`
    group border-l-4 transition-all duration-200 hover:shadow-md m-2
    bg-card border-border
    ${
      pinned
        ? "border-l-primary"
        : "border-l-border hover:border-l-muted-foreground"
    }
  `}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-muted-foreground bg-secondary px-2 py-1 rounded-full">
              {date}
            </span>
            {pinned && (
              <span className="text-xs font-bold text-primary bg-secondary mb-0.5 px-2 py-1 rounded-full flex items-center gap-1">
                <BsPinAngleFill className="text-xs" />
                Fixado
              </span>
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={(handleTogglePin)}
              className={`
                p-1.5 rounded-lg transition-all duration-200
                ${
                  pinned
                    ? "text-primary hover:bg-primary/10"
                    : "text-muted-foreground hover:text-muted-foreground hover:bg-secondary"
                }
              `}
              aria-label="Fixar nota"
            >
              {pinned ? <BsPinAngleFill size={16} /> : <BsPinAngle size={16} />}
            </button>

            {isEditing ? (
              <button
                onClick={handleSaveEdit}
                className="p-1.5 text-primary hover:text-primary hover:bg-primary/10 rounded-lg"
                aria-label="Salvar edição"
              >
                <FaCheck size={16} />
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 text-muted-foreground hover:text-muted-foreground hover:bg-secondary rounded-lg"
                aria-label="Editar nota"
              >
                <FaEdit size={16} />
              </button>
            )}

            <button
              onClick={(handleDelete)}
              className="p-1.5 text-destructive hover:text-destructive hover:bg-destructive rounded-lg"
              aria-label="Excluir nota"
            >
              <FaTrash size={16} />
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        {isEditing ? (
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="text-foreground/80 font-bold text-base leading-relaxed min-h-[100px]"
            autoFocus
          />
        ) : (
          <>
            <p
              className={`
              text-foreground text-base leading-relaxed whitespace-pre-wrap break-all 
              ${pinned ? "font-medium" : "font-normal"}
            `}
            >
              {displayContent}
            </p>

            {/* Botão Ver mais / Ver menos */}
            {shouldShowButton && !isEditing && (
              <button
                onClick={toggleExpand}
                className="text-sm text-primary hover:text-primary font-medium mt-2 transition-colors"
              >
                {isExpanded ? "Ver menos" : "Ver mais"}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
