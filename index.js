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
function loadData() {
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

// Допоміжна функція для пошуку датчика за ID
function findSensorOrExit(data, id) {
  if (!data.sensors || !Array.isArray(data.sensors)) {
    console.error('Помилка: У JSON-файлі відсутній масив "sensors".');
    process.exit(1);
  }
  const sensor = data.sensors.find((s) => s.id === id);
  if (!sensor) {
    console.error(`Помилка: Датчик з ідентифікатором "${id}" не знайдено.`);
    process.exit(1);
  }
  return sensor;
}


//Перелік основних елементів
program
  .command('list')
  .description('Показати стислий список датчиків')
  .option('-l, --limit <number>', 'обмежити кількість датчиків у списку')
  .action((options) => {
    const data = loadData();
    let sensors = data.sensors || [];

    if (options.limit) {
      const limit = parseInt(options.limit, 10);
      if (isNaN(limit) || limit <= 0) {
        console.error('Помилка: Значення опції --limit має бути додатним числом.');
        process.exit(1);
      }
      sensors = sensors.slice(0, limit);
    }

    console.log(`Метеостанція: ${data.stationName || 'Невідомо'}`);
    console.log('Список датчиків:');
    sensors.forEach((s) => {
      console.log(`- [${s.id}] ${s.name} (${s.type})`);
    });
  });

//Один елемент цілком
program
  .command('get')
  .description('Показати повну інформацію про один датчик за його ID')
  .argument('<id>', 'ідентифікатор датчика')
  .action((id) => {
    const data = loadData();
    const sensor = findSensorOrExit(data, id);
    console.log(JSON.stringify(sensor, null, 2));
  });

//Окреме поле (зокрема вкладене)
program
  .command('field')
  .description('Показати значення окремого (зокрема вкладеного) поля датчика за точковим шляхом')
  .argument('<id>', 'ідентифікатор датчика')
  .argument('<path>', 'шлях до поля через крапку (наприклад, readings.0.value)')
  .action((id, path) => {
    const data = loadData();
    const sensor = findSensorOrExit(data, id);

    const keys = path.split('.');
    let current = sensor;

    for (const key of keys) {
      if (current === undefined || current === null || !(key in current)) {
        console.error(`Помилка: Поле "${path}" відсутнє у датчика "${id}".`);
        process.exit(1);
      }
      current = current[key];
    }

    if (current === null) {
      console.log('значення: null');
    } else if (typeof current === 'object') {
      console.log(JSON.stringify(current, null, 2));
    } else {
      console.log(current);
    }
  });

program.parse(process.argv);