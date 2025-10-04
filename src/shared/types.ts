export interface BrowserAPI {
  tabs: {
    query(queryInfo: {
      active: boolean;
      currentWindow: boolean;
    }): Promise<Array<{ id?: number; url?: string }>>;
    update(tabId: number, updateProperties: { url: string }): Promise<any>;
  };
}

export interface QueryLensOptions {
  autoInit?: boolean;
}
