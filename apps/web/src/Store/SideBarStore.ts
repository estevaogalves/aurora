import { create } from "zustand";

type SideBarStore = {
    isOpen: boolean;
    toggle: () => void;
    close: () => void;
    open: () => void;
}

export const useSideBarStore = create<SideBarStore>((set) => ({
    isOpen: true,
    toggle: () => set((state) => ({isOpen: !state.isOpen})),
    close: () => set({isOpen: false}),
    open: () => set({isOpen: true}) 
}))