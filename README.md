# Школьный рейтинг (React + Vite)

Фронтенд для рейтинга учеников с авторизацией администраторов, онлайн-присутствием и историей изменений. Проект использует React, Vite, Firebase Auth, Firestore и Realtime Database.

## Функции
- Публичная главная страница с таблицей рейтинга.
- Админ-логин по username → `${username}@school.local` (например, `admin1/admin123`, `admin2/admin123`).
- Проверка прав: наличие документа `admins/{uid}` в Firestore.
- Редактирование таблицы администраторами с обновлением в реальном времени.
- Presence через Realtime Database (`/presence/{uid}`) с индикацией, кто онлайн и что редактирует.
- История изменений в коллекции `history` (ts, user, rowId, col, before, after), доступна только админам.
- Импорт Excel (`Итог.xlsx`, лист "РЕЙТИНГ ИТОГ") через SheetJS (xlsx) c записью в Firestore (`meta/columns`, `rows`).

## Настройка Firebase
1. Создайте проект Firebase и включите:
   - Authentication (Email/Password)
   - Firestore Database
   - Realtime Database
2. Скопируйте конфигурацию Firebase в файл `src/firebase.js` вместо значений `TODO`.
3. Создайте пользователей с email `admin1@school.local` и `admin2@school.local` и паролем `admin123`.
4. Добавьте документы в Firestore `admins/{uid}` для соответствующих UID администраторов.

## Запуск проекта
```bash
npm install
npm run dev
```

## Структура
- `src/firebase.js` — инициализация Firebase.
- `src/App.jsx` — основная страница и логика авторизации/прав.
- `src/components/*` — таблица рейтинга, импорт, присутствие, история.
- `public/` — статические файлы (favicon).

## Импорт рейтинга из Excel
1. Подготовьте файл `Итог.xlsx` с листом "РЕЙТИНГ ИТОГ":
   - Первая строка — заголовки.
   - Первый столбец — `name`.
2. Войдите как админ и загрузите файл через блок "Импорт Excel" — данные появятся в Firestore и станут доступны для редактирования.

## Билд
```bash
npm run build
```
