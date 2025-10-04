export interface BrowserAPI {
  tabs: {
    query(queryInfo: {
      active: boolean;
      currentWindow: boolean;
    }): Promise<Array<{ id?: number; url?: string }>>;
    update(tabId: number, updateProperties: { url: string }): Promise<void>;
  };
}

export interface QueryLensOptions {
  autoInit?: boolean;
}
