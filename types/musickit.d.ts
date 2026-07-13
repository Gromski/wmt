declare global {
  interface Window {
    MusicKit: {
      configure(config: {
        developerToken: string;
        app: { name: string; build: string };
      }): void;
      getInstance(): {
        authorize(): Promise<string>;
        isAuthorized: boolean;
      };
    };
  }
}

export {};
