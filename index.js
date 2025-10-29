const axios = require('axios');
const cheerio = require('cheerio');
const core = require('@actions/core');

const version = process.argv[2]; // Получение версии OpenWRT из аргумента командной строки
const filterTargetsStr = process.argv[3] || ''; // Фильтр по targets (опционально, через запятую)
const filterSubtargetsStr = process.argv[4] || ''; // Фильтр по subtargets (опционально, через запятую)
const manualPkgarch = process.argv[5] || ''; // Ручное указание pkgarch (опционально)
const manualVermagic = process.argv[6] || ''; // Ручное указание vermagic (опционально)
const kernelVersion = process.argv[7] || ''; // Полная версия ядра (опционально, например: 5.15.167-1-144de9e5c1a8813b724b14faa054d9f0)

// Преобразуем строки с запятыми в массивы
const filterTargets = filterTargetsStr ? filterTargetsStr.split(',').map(t => t.trim()).filter(t => t) : [];
const filterSubtargets = filterSubtargetsStr ? filterSubtargetsStr.split(',').map(s => s.trim()).filter(s => s) : [];

if (!version) {
  core.setFailed('Version argument is required');
  process.exit(1);
}

// Извлекаем vermagic из полной версии ядра, если указана
let extractedVermagic = manualVermagic;
if (kernelVersion && !manualVermagic) {
  // Извлекаем хеш из строки вида: 5.15.167-1-144de9e5c1a8813b724b14faa054d9f0
  const match = kernelVersion.match(/\d+\.\d+\.\d+(?:-\d+)?-([a-f0-9]{32})/);
  if (match) {
    extractedVermagic = match[1];
    console.log(`Extracted vermagic from kernel version: "${extractedVermagic}"`);
  } else {
    console.log(`Warning: Could not extract vermagic from kernel version: "${kernelVersion}"`);
  }
}

// Логирование режима работы
if (manualPkgarch && extractedVermagic) {
  console.log(`Manual mode: pkgarch="${manualPkgarch}", vermagic="${extractedVermagic}"`);
} else if (kernelVersion) {
  console.log(`Kernel version mode: using kernel="${kernelVersion}"`);
} else {
  console.log('Auto-detection mode: pkgarch and vermagic will be extracted from kernel_*.ipk');
}

const url = `https://downloads.openwrt.org/releases/${version}/targets/`;

async function fetchHTML(url) {
  try {
    const { data } = await axios.get(url);
    return cheerio.load(data);
  } catch (error) {
    console.error(`Error fetching HTML for ${url}: ${error}`);
    throw error;
  }
}

async function getTargets() {
  const $ = await fetchHTML(url);
  const targets = [];
  $('table tr td.n a').each((index, element) => {
    const name = $(element).attr('href');
    if (name && name.endsWith('/')) {
      targets.push(name.slice(0, -1));
    }
  });
  return targets;
}

async function getSubtargets(target) {
  const $ = await fetchHTML(`${url}${target}/`);
  const subtargets = [];
  $('table tr td.n a').each((index, element) => {
    const name = $(element).attr('href');
    if (name && name.endsWith('/')) {
      subtargets.push(name.slice(0, -1));
    }
  });
  return subtargets;
}

async function getDetails(target, subtarget) {
  // Если pkgarch и vermagic указаны вручную (или извлечены из kernel_version), используем их
  if (manualPkgarch && extractedVermagic) {
    return { vermagic: extractedVermagic, pkgarch: manualPkgarch };
  }

  // Иначе извлекаем из kernel_*.ipk
  const packagesUrl = `${url}${target}/${subtarget}/packages/`;
  const $ = await fetchHTML(packagesUrl);
  let vermagic = '';
  let pkgarch = '';

  $('a').each((index, element) => {
    const name = $(element).attr('href');
    if (name && name.startsWith('kernel_')) {
      const vermagicMatch = name.match(/kernel_\d+\.\d+\.\d+(?:-\d+)?[-~]([a-f0-9]+)(?:-r\d+)?_([a-zA-Z0-9_-]+)\.ipk$/);
      if (vermagicMatch) {
        vermagic = vermagicMatch[1];
        pkgarch = vermagicMatch[2];
      }
    }
  });

  return { vermagic, pkgarch };
}

async function main() {
  try {
    const targets = await getTargets();
    const jobConfig = [];

    for (const target of targets) {
      // Пропускаем target, если указан массив фильтров и target не входит в него
      if (filterTargets.length > 0 && !filterTargets.includes(target)) {
        continue;
      }

      const subtargets = await getSubtargets(target);
      for (const subtarget of subtargets) {
        // Пропускаем subtarget, если указан массив фильтров и subtarget не входит в него
        if (filterSubtargets.length > 0 && !filterSubtargets.includes(subtarget)) {
          continue;
        }

        // Добавляем в конфигурацию только если:
        // 1. Оба массива пустые (автоматическая сборка по тегу) - собираем всё
        // 2. Оба массива НЕ пустые (ручной запуск) - target И subtarget должны быть в своих массивах
        const isAutomatic = filterTargets.length === 0 && filterSubtargets.length === 0;
        const isManualMatch = filterTargets.length > 0 && filterSubtargets.length > 0 &&
                              filterTargets.includes(target) && filterSubtargets.includes(subtarget);
        
        if (!isAutomatic && !isManualMatch) {
          continue;
        }

        const { vermagic, pkgarch } = await getDetails(target, subtarget);

        jobConfig.push({
          tag: version,
          target,
          subtarget,
          vermagic,
          pkgarch,
          kernel_version: kernelVersion || '', // Передаем полную версию ядра, если указана
        });
      }
    }

    core.setOutput('job-config', JSON.stringify(jobConfig));
  } catch (error) {
    core.setFailed(error.message);
  }
}

main();
