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
    bg-slate-900 border-slate-600
    ${
      pinned
        ? "border-l-emerald-600"
        : "border-l-gray-600 hover:border-l-gray-500"
    }
  `}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {date}
            </span>
            {pinned && (
              <span className="text-xs font-bold text-emerald-700 bg-slate-200 mb-0.5 px-2 py-1 rounded-full flex items-center gap-1">
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
                    ? "text-emerald-600 hover:bg-emerald-100"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                }
              `}
              aria-label="Fixar nota"
            >
              {pinned ? <BsPinAngleFill size={16} /> : <BsPinAngle size={16} />}
            </button>

            {isEditing ? (
              <button
                onClick={handleSaveEdit}
                className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg"
                aria-label="Salvar edição"
              >
                <FaCheck size={16} />
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-lg"
                aria-label="Editar nota"
              >
                <FaEdit size={16} />
              </button>
            )}

            <button
              onClick={(handleDelete)}
              className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
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
            className="text-gray-300 font-bold text-base leading-relaxed min-h-[100px]"
            autoFocus
          />
        ) : (
          <>
            <p
              className={`
              text-white text-base leading-relaxed whitespace-pre-wrap break-all 
              ${pinned ? "font-medium" : "font-normal"}
            `}
            >
              {displayContent}
            </p>

            {/* Botão Ver mais / Ver menos */}
            {shouldShowButton && !isEditing && (
              <button
                onClick={toggleExpand}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium mt-2 transition-colors"
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
