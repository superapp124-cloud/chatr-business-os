export interface FormField {
  id: string;
  name: string;
  type: string;
  label?: string;
  placeholder?: string;
  value?: string;
}

export interface BrowserAutomationProvider {
  /**
   * Initializes the browser environment.
   */
  open(url: string): Promise<void>;

  /**
   * Navigates to a specific URL.
   */
  navigate(url: string): Promise<void>;

  /**
   * Scans the current page and detects input fields.
   */
  detectForm(): Promise<FormField[]>;

  /**
   * Fills the detected form with the provided key-value mapping.
   */
  fill(data: Record<string, any>): Promise<void>;

  /**
   * Uploads files to the currently active file input or standard file upload zones.
   */
  upload(filePaths: string[]): Promise<void>;

  /**
   * Takes a screenshot of the current page.
   */
  screenshot(path: string): Promise<void>;

  /**
   * Extracts data from the current page (e.g. API keys, status text).
   */
  extract(selector?: string): Promise<any>;

  /**
   * Waits for a specific condition or element to be visible.
   */
  wait(condition: string): Promise<void>;

  /**
   * Closes the browser.
   */
  close(): Promise<void>;
}
