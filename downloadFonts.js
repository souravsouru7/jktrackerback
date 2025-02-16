const https = require('https');
const fs = require('fs');
const path = require('path');

const fonts = [
  {
    url: 'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/static/Roboto-Regular.ttf',
    filename: 'Roboto-Regular.ttf'
  },
  {
    url: 'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/static/Roboto-Medium.ttf',
    filename: 'Roboto-Medium.ttf'
  },
  {
    url: 'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/static/Roboto-Italic.ttf',
    filename: 'Roboto-Italic.ttf'
  },
  {
    url: 'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/static/Roboto-MediumItalic.ttf',
    filename: 'Roboto-MediumItalic.ttf'
  }
];

const downloadFont = (url, filename) => {
  return new Promise((resolve, reject) => {
    const filepath = path.join(__dirname, 'fonts', filename);
    const file = fs.createWriteStream(filepath);

    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded ${filename}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath);
      reject(err);
    });
  });
};

async function downloadAllFonts() {
  try {
    await Promise.all(fonts.map(font => downloadFont(font.url, font.filename)));
    console.log('All fonts downloaded successfully!');
  } catch (error) {
    console.error('Error downloading fonts:', error);
  }
}

downloadAllFonts();
