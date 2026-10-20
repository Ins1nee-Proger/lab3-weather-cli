import { Command } from 'commander';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const program = new Command();

program
  .name('weather-cli')
  .description('CLI-програма для аналізу даних метеостанції')
  .version('1.0.0')
  .option('-f, --file <path>', 'шлях до JSON-файлу з даними', 'data.json');

// Допоміжна функція для читання та парсингу JSON
export function loadData() {
  const options = program.opts();
  const filePath = resolve(options.file);

  try {
    const rawData = readFileSync(filePath, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Помилка: Файл за шляхом "${filePath}" не знайдено.`);
    } else if (error instanceof SyntaxError) {
      console.error(`Помилка: Файл "${filePath}" містить некоректний JSON-формат.`);
    } else {
      console.error(`Помилка під час читання файлу: ${error.message}`);
    }
    process.exit(1);
  }
}

// Перевірка базового запуску
program.action(() => {
  const data = loadData();
  console.log(`Успішно завантажено дані метеостанції: ${data.stationName || 'Без назви'}`);
});

program.parse(process.argv);