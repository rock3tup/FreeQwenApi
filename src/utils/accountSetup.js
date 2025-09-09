import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { initBrowser, shutdownBrowser, getBrowserContext } from '../browser/browser.js';
import { extractAuthToken } from '../api/chat.js';
import { loadTokens, saveTokens, markValid, removeToken } from '../api/tokenManager.js';
import { loadAuthToken } from '../browser/session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ensureAccountDir(id) {
    const accountDir = path.join(__dirname, '..', '..', 'session', 'accounts', id);
    if (!fs.existsSync(accountDir)) {
        fs.mkdirSync(accountDir, { recursive: true });
    }
    return accountDir;
}

export async function addAccountInteractive() {
    console.log('======================================================');
    console.log('Добавление нового аккаунта Qwen');
    console.log('Браузер откроется, войдите в систему. Этот процесс может занять до минуты.');
    console.log('======================================================');

    const ok = await initBrowser(true, true);
    if (!ok) {
        console.error('Не удалось запустить браузер.');
        return null;
    }

    const ctx = getBrowserContext();
    let token = await extractAuthToken(ctx, true);

    if (!token) {
        token = loadAuthToken();
        if (token) {
            console.log('Токен получен из сохранённого файла.');
        }
    }

    await shutdownBrowser();

    if (!token) {
        console.error('Токен не был получен. Аккаунт не добавлен.');
        return null;
    }

    const id = 'acc_' + Date.now();
    ensureAccountDir(id);
    fs.writeFileSync(path.join(__dirname, '..', '..', 'session', 'accounts', id, 'token.txt'), token, 'utf8');

    const list = loadTokens();
    list.push({ id, token, resetAt: null });
    saveTokens(list);

    console.log(`Аккаунт '${id}' добавлен. Всего аккаунтов: ${list.length}`);
    console.log('======================================================');
    return id;
}

export async function reloginAccount(accountId) {
    const tokens = loadTokens();
    const account = tokens.find(t => t.id === accountId);
    if (!account) {
        throw new Error('Аккаунт не найден');
    }

    console.log(`\nПовторная авторизация для ${account.id}`);
    const ok = await initBrowser(true, true);
    if (!ok) {
        throw new Error('Не удалось запустить браузер');
    }

    const token = await extractAuthToken(getBrowserContext(), true);
    await shutdownBrowser();

    if (!token) {
        throw new Error('Не удалось извлечь токен');
    }

    markValid(account.id, token);
    fs.writeFileSync(path.join(__dirname, '..', '..', 'session', 'accounts', account.id, 'token.txt'), token, 'utf8');

    console.log(`Токен обновлён для ${account.id}`);
    return { success: true, accountId: account.id };
}

export function removeAccount(accountId) {
    removeToken(accountId);
    const dir = path.join(__dirname, '..', '..', 'session', 'accounts', accountId);
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    console.log(`Аккаунт ${accountId} удалён.`);
    return { success: true, accountId: accountId };
} 