// Drag-and-drop per una dropzone di file — stesso pattern già in uso per
// il CV in onboarding prima di questo fix: estrae il primo file
// trascinato e lo passa alla stessa funzione già usata dal click
// sull'input nascosto, così le due modalità restano sempre coerenti.
export function useFileDrop(onFile: (file: File) => void) {
  return {
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
  };
}
