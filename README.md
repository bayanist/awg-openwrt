# 🔧 Автоматический патчинг для кастомных OpenWRT

## Описание проблемы

При сборке `kmod-amneziawg` через OpenWRT SDK, зависимость от ядра берется из SDK:

```
SDK для 23.05.5 → kernel (= 5.15.167-1-ХХХХХХ)
SDK для 23.05.1 → kernel (= 5.15.137-1-ХХХХХХ)
```

Но что если у вас:
- Кастомная прошивка с другой версией ядра
- Патченое ядро
- Snapshot версия

## ✅ Решение: Автоматический патчинг

Если вы укажете параметр `kernel_version`, workflow **автоматически пропатчит** собранный пакет `kmod-amneziawg`!

### Как это работает:

1. **Сборка пакета** через SDK (с версией ядра из SDK)
2. **Распаковка IPK** файла
3. **Замена зависимости** в файле `control`
4. **Упаковка обратно** в IPK

### Пример:

**Вы указали:**
```yaml
kernel_version: 5.15.167-1-144de9e5c1a8813b724b14faa054d9f0
```

**До патчинга** (из SDK):
```
Depends: kernel (= 5.15.137-1-9c242f353867f49a96054ff8c9f2c460)
```

**После патчинга:**
```
Depends: kernel (= 5.15.167-1-144de9e5c1a8813b724b14faa054d9f0)
```
### Отлично! Собранный пакет`ipk` для OpenWRT, будет работать на вашем утсройстве!

## 🎯 Использование

### Шаг 1: Узнайте версию ядра на вашем устройстве

```bash
ssh root@your-router
opkg list-installed | grep "^kernel "
# Вывод: kernel - 5.15.167-1-144de9e5c1a8813b724b14faa054d9f0
```

### Шаг 2: Укажите при сборке в GitHub Actions

```yaml
OpenWRT version: 23.05.5  # Любая версия SDK
Targets: ramips
Subtargets: mt7621
pkgarch: mipsel_24kc
vermagic: (пусто)
kernel_version: 5.15.167-1-144de9e5c1a8813b724b14faa054d9f0  ← Ваша версия!
```

### Шаг 3: Дождитесь сборки

В логах вы увидите:

```
Custom kernel version specified: 5.15.167-1-144de9e5c1a8813b724b14faa054d9f0
Patching kmod-amneziawg to depend on kernel = 5.15.167-1-144de9e5c1a8813b724b14faa054d9f0
Found package: bin/targets/ramips/mt7621/kmod-amneziawg_...ipk
Patched control file:
Depends: kernel (= 5.15.167-1-144de9e5c1a8813b724b14faa054d9f0), ...
Kernel dependency patched successfully!
```

### Шаг 4: Установите на устройство

```bash
opkg install kmod-amneziawg_*.ipk
# ✅ Успешно установлено!
```

## 📋 Технические детали

### Структура IPK файла:

```
kmod-amneziawg_*.ipk
├── debian-binary       # Версия формата
├── control.tar.gz      # Метаданные пакета
│   └── control         # ← Здесь находится Depends:
└── data.tar.gz         # Файлы пакета (amneziawg.ko)
```

### Процесс патчинга:

```bash
# 1. Распаковка IPK
ar x kmod-amneziawg_*.ipk

# 2. Распаковка control.tar.gz
tar -xzf control.tar.gz

# 3. Замена зависимости
sed -i "s/Depends: kernel (= [^)]*)/Depends: kernel (= $KERNEL_VERSION)/" control

# 4. Упаковка control.tar.gz
tar -czf control.tar.gz control

# 5. Упаковка IPK
ar r package.ipk debian-binary control.tar.gz data.tar.gz
```
