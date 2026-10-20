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


//Загальні можливості

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


//Можливості варіанта
//Характеристики обраного датчика
program
  .command('sensor')
  .description('Показати характеристики обраного датчика')
  .argument('<id>', 'ідентифікатор датчика')
  .action((id) => {
    const data = loadData();
    const sensor = findSensorOrExit(data, id);

    console.log(`ID: ${sensor.id}`);
    console.log(`Назва: ${sensor.name}`);
    console.log(`Тип: ${sensor.type}`);
    console.log(`Одиниця вимірювання: ${sensor.unit}`);
    console.log(`Кількість показів: ${sensor.readings ? sensor.readings.length : 0}`);
  });

//Серія показів датчика (з можливістю пропускати відсутні)
program
  .command('readings')
  .description('Показати серію показів датчика')
  .argument('<id>', 'ідентифікатор датчика')
  .option('--skip-missing', 'пропускати відсутні покази (null)')
  .action((id, options) => {
    const data = loadData();
    const sensor = findSensorOrExit(data, id);

    let readings = sensor.readings || [];

    if (options.skipMissing) {
      readings = readings.filter((r) => r.value !== null && r.value !== undefined);
    }

    console.log(`Покази датчика "${sensor.name}":`);
    readings.forEach((r) => {
      const val = r.value === null ? 'НЕДОСТУПНО' : `${r.value} ${sensor.unit}`;
      console.log(`- [${r.timestamp}] ${val}`);
    });
  });

//Мінімум, максимум і середнє без урахування відсутніх показів
program
  .command('stats')
  .description('Розрахувати мінімум, максимум і середнє значення показів датчика')
  .argument('<id>', 'ідентифікатор датчика')
  .action((id) => {
    const data = loadData();
    const sensor = findSensorOrExit(data, id);

    const validValues = (sensor.readings || [])
      .map((r) => r.value)
      .filter((v) => typeof v === 'number' && !isNaN(v));

    if (validValues.length === 0) {
      console.error(`Помилка: Немає числових показів для датчика "${id}".`);
      process.exit(1);
    }

    const min = Math.min(...validValues);
    const max = Math.max(...validValues);
    const sum = validValues.reduce((acc, val) => acc + val, 0);
    const avg = sum / validValues.length;

    console.log(`Статистика для датчика "${sensor.name}" (${sensor.unit}):`);
    console.log(`- Мінімальне значення: ${min}`);
    console.log(`- Максимальне значення: ${max}`);
    console.log(`- Середнє значення: ${avg.toFixed(2)}`);
  });

program.parse(process.argv);