import express from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

import tasksRouter from './server/src/routes/tasks.js';
import usersRouter from './server/src/routes/users.js';
import chatRouter from './server/src/routes/chat.js';

import registerChatSocket from './server/src/sockets/chat.js';
import { setIO } from './server/src/sockets/io.js';
import { startTelegramBot } from './server/src/telegram/telegram.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

setIO(io);

app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/tasks', tasksRouter);
app.use('/api/users', usersRouter);
app.use('/api/chat', chatRouter);

registerChatSocket(io);

app.use((req, res) => {
    res.status(404).json({
        message: 'Rota não encontrada.'
    });
});

let telegramBot = null;

httpServer.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    telegramBot = startTelegramBot();
});

function shutdown() {
    Promise.resolve(telegramBot?.stop())
        .catch(() => {})
        .finally(() => process.exit(0));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);