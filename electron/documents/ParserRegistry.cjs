const fs = require('fs');
const path = require('path');

class ParserRegistry {
  constructor() {
    this.parsers = new Map();
    this.registerDefaults();
  }

  registerDefaults() {
    // TXT/MD/CSV/JSON/HTML Parser
    const textParser = {
      version: '1.0.0',
      extensions: ['.txt', '.md', '.csv', '.json', '.html', '.xml', '.yaml', '.yml', '.ini', '.log'],
      parse: async (filePath) => {
        const stats = fs.statSync(filePath);
        // If file is > 5MB, truncate it
        const maxSize = 5 * 1024 * 1024;
        let content = '';
        if (stats.size > maxSize) {
          const buffer = Buffer.alloc(maxSize);
          const fd = fs.openSync(filePath, 'r');
          fs.readSync(fd, buffer, 0, maxSize, 0);
          fs.closeSync(fd);
          content = buffer.toString('utf-8');
        } else {
          content = fs.readFileSync(filePath, 'utf-8');
        }
        
        return {
          text: content,
          metadata: {
            success: true,
            character_count: content.length,
            truncated: stats.size > maxSize
          }
        };
      }
    };

    textParser.extensions.forEach(ext => this.registerParser(ext, textParser));

    // PDF Parser
    const pdfParser = {
      version: '1.0.0',
      extensions: ['.pdf'],
      parse: async (filePath) => {
        try {
          // Dynamic require so it doesn't fail if not installed yet
          const pdfParse = require('pdf-parse');
          const dataBuffer = fs.readFileSync(filePath);
          const data = await pdfParse(dataBuffer);
          return {
            text: data.text,
            metadata: {
              success: true,
              character_count: data.text.length,
              page_count: data.numpages,
              truncated: false
            }
          };
        } catch (err) {
          return { text: '', metadata: { success: false, error: err.message } };
        }
      }
    };
    this.registerParser('.pdf', pdfParser);

    // DOCX Parser
    const docxParser = {
      version: '1.0.0',
      extensions: ['.docx'],
      parse: async (filePath) => {
        try {
          const mammoth = require('mammoth');
          const result = await mammoth.extractRawText({ path: filePath });
          return {
            text: result.value,
            metadata: {
              success: true,
              warnings: result.messages,
              character_count: result.value.length,
              truncated: false
            }
          };
        } catch (err) {
          return { text: '', metadata: { success: false, error: err.message } };
        }
      }
    };
    this.registerParser('.docx', docxParser);

    // Excel Parser (XLSX, XLS)
    const excelParser = {
      version: '1.0.0',
      extensions: ['.xlsx', '.xls', '.csv'],
      parse: async (filePath) => {
        try {
          const xlsx = require('xlsx');
          const workbook = xlsx.readFile(filePath);
          let allText = '';
          workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            allText += `--- Sheet: ${sheetName} ---\n`;
            allText += xlsx.utils.sheet_to_txt(sheet) + '\n';
          });
          return {
            text: allText,
            metadata: {
              success: true,
              character_count: allText.length,
              truncated: false
            }
          };
        } catch (err) {
          return { text: '', metadata: { success: false, error: err.message } };
        }
      }
    };
    this.registerParser('.xlsx', excelParser);
    this.registerParser('.xls', excelParser);

    // Image OCR Parser
    const imageParser = {
      version: '1.0.0',
      extensions: ['.png', '.jpg', '.jpeg', '.bmp', '.tiff'],
      parse: async (filePath) => {
        try {
          const tesseract = require('tesseract.js');
          const { data: { text } } = await tesseract.recognize(filePath, 'eng', {
            logger: () => {} // Silence verbose logging
          });
          return {
            text,
            metadata: {
              success: true,
              character_count: text.length,
              truncated: false
            }
          };
        } catch (err) {
          return { text: '', metadata: { success: false, error: err.message } };
        }
      }
    };
    imageParser.extensions.forEach(ext => this.registerParser(ext, imageParser));
  }

  registerParser(extension, parser) {
    this.parsers.set(extension.toLowerCase(), parser);
  }

  getParser(extension) {
    return this.parsers.get(extension.toLowerCase());
  }

  async parse(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const parser = this.getParser(ext);
    
    if (!parser) {
      return {
        text: '',
        metadata: { success: false, error: 'No parser available for extension ' + ext }
      };
    }

    try {
      const result = await parser.parse(filePath);
      return result;
    } catch (err) {
      return { text: '', metadata: { success: false, error: err.message } };
    }
  }
}

module.exports = new ParserRegistry();
