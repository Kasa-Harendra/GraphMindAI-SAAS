import { create } from "zustand";
import { notificationsApi } from "@/lib/api";

export interface NotificationMessage {
  id: string;
  type: string;
  message: string;
  status?: string;
  doc_id?: string;
  timestamp: number;
  read: boolean;
}

interface NotificationStore {
  connected: boolean;
  notifications: NotificationMessage[];
  unreadCount: number;
  connect: () => void;
  disconnect: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

let eventSource: EventSource | null = null;

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  connected: false,
  notifications: [],
  unreadCount: 0,

  connect: async () => {
    if (eventSource) return; // Already connected or connecting
    
    // Fetch historical notifications first
    try {
      const history = await notificationsApi.history();
      set({
        notifications: history,
        unreadCount: history.filter(n => !n.read).length
      });
    } catch (e) {
      console.error("Failed to fetch notification history:", e);
    }
    
    try {
      eventSource = notificationsApi.streamNotifications();
      
      eventSource.onopen = () => {
        set({ connected: true });
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "CONNECTED") {
            set({ connected: true });
            return;
          }

          const newNotification: NotificationMessage = {
            id: Math.random().toString(36).substring(7),
            timestamp: Date.now(),
            read: false,
            ...data
          };

          set((state) => {
            const newNotifs = [newNotification, ...state.notifications].slice(0, 50); // Keep last 50
            return {
              notifications: newNotifs,
              unreadCount: state.unreadCount + 1,
            };
          });
        } catch (e) {
          console.error("Failed to parse notification:", e);
        }
      };

      eventSource.onerror = () => {
        set({ connected: false });
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          get().connect();
        }, 5000);
      };
    } catch (error) {
      console.error("Error setting up SSE:", error);
    }
  },

  disconnect: () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    set({ connected: false });
  },

  markAsRead: (id: string) => {
    set((state) => {
      const notifications = state.notifications.map(n => 
        n.id === id ? { ...n, read: true } : n
      );
      return {
        notifications,
        unreadCount: Math.max(0, state.unreadCount - 1)
      };
    });
  },

  markAllAsRead: async () => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0
    }));
    
    // Update backend
    try {
      await notificationsApi.markAllAsRead();
    } catch (e) {
      console.error("Failed to mark notifications as read:", e);
    }
  },

  clearAll: () => {
    set({ notifications: [], unreadCount: 0 });
  }
}));
