
import { Router } from 'express';
import pool from '../../database.js';
import {
    createTaskSchema,
    updateTaskSchema
} from '../schemas/taskSchema.js';

const router = Router();

router.get('/:userId', async (req, res) => {
    try {
        const userId = Number(req.params.userId);

        if (!Number.isSafeInteger(userId) || userId <= 0) {
            return res.status(400).json({
                message: 'ID do usuário inválido.'
            });
        }

        const [users] = await pool.execute(
            'SELECT id FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                message: 'Usuário não encontrado.'
            });
        }

        const [tasks] = await pool.execute(`
            SELECT
                tasks.id,
                tasks.title,
                tasks.description,
                tasks.status,
                tasks.created_at
            FROM tasks
            WHERE tasks.user_id = ?
            ORDER BY tasks.id DESC
        `, [userId]);

        return res.status(200).json(tasks);
    } catch (error) {
        console.error('Erro ao listar tarefas:', error);

        return res.status(500).json({
            message: 'Erro interno ao listar tarefas.'
        });
    }
});

router.get('/:userId/:taskId', async (req, res) => {
    try {

        const userId = Number(req.params.userId);
        const taskId = Number(req.params.taskId);

        if (
            !Number.isSafeInteger(userId) || userId <= 0 ||
            !Number.isSafeInteger(taskId) || taskId <= 0
        ) {
            return res.status(400).json({
                message: 'ID do usuário ou da tarefa inválido.'
            });
        }

        const [tasks] = await pool.execute(`
            SELECT
                tasks.id,
                tasks.title,
                tasks.description,
                tasks.status,
                tasks.created_at
            FROM tasks
            WHERE tasks.id = ?
              AND tasks.user_id = ?
        `, [taskId, userId]);

        if (tasks.length === 0) {
            return res.status(404).json({
                message: 'Tarefa não encontrada para este usuário.'
            });
        }

        return res.status(200).json(tasks[0]);
    } catch (error) {
        console.error('Erro ao buscar tarefa:', error);

        return res.status(500).json({
            message: 'Erro interno ao buscar tarefa.'
        });
    }
});

router.post('/', async (req, res) => {
    try {

        const validation = createTaskSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                message: 'Dados inválidos.',
                errors: validation.error.issues.map(issue => ({
                    field: issue.path.join('.'),
                    message: issue.message
                }))
            });
        }

        const { title, description, status, user_id } = validation.data;

        const [users] = await pool.execute(
            'SELECT id FROM users WHERE id = ?',
            [user_id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                message: 'Usuário não encontrado.'
            });
        }

        const [result] = await pool.execute(`
            INSERT INTO tasks (title, description, status, user_id)
            VALUES (?, ?, ?, ?)
        `, [
            title,
            description ?? null,
            status,
            user_id
        ]);

        return res.status(201).json({
            message: 'Tarefa criada com sucesso.',
            id: result.insertId
        });
    } catch (error) {
        console.error('Erro ao criar tarefa:', error);

        return res.status(500).json({
            message: 'Erro interno ao criar tarefa.'
        });
    }
});

router.put('/:userId/:taskId', async (req, res) => {
    try {

        const userId = Number(req.params.userId);
        const taskId = Number(req.params.taskId);

        if (
            !Number.isSafeInteger(userId) || userId <= 0 ||
            !Number.isSafeInteger(taskId) || taskId <= 0
        ) {
            return res.status(400).json({
                message: 'ID do usuário ou da tarefa inválido.'
            });
        }

        const validation = updateTaskSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                message: 'Dados inválidos.',
                errors: validation.error.issues.map(issue => ({
                    field: issue.path.join('.'),
                    message: issue.message
                }))
            });
        }

        const { title, description, status } = validation.data;

        const [tasks] = await pool.execute(`
            SELECT id
            FROM tasks
            WHERE id = ? AND user_id = ?
        `, [taskId, userId]);

        if (tasks.length === 0) {
            return res.status(404).json({
                message: 'Tarefa não encontrada para este usuário.'
            });
        }

        await pool.execute(`
            UPDATE tasks
            SET title = ?, description = ?, status = ?
            WHERE id = ? AND user_id = ?
        `, [
            title,
            description ?? null,
            status,
            taskId,
            userId
        ]);

        return res.status(200).json({
            message: 'Tarefa atualizada com sucesso.',
            id: taskId
        });
    } catch (error) {
        console.error('Erro ao atualizar tarefa:', error);

        return res.status(500).json({
            message: 'Erro interno ao atualizar tarefa.'
        });
    }
});

router.delete('/:userId/:taskId', async (req, res) => {
    try {
        
        const userId = Number(req.params.userId);
        const taskId = Number(req.params.taskId);

        if (
            !Number.isSafeInteger(userId) || userId <= 0 ||
            !Number.isSafeInteger(taskId) || taskId <= 0
        ) {
            return res.status(400).json({
                message: 'ID do usuário ou da tarefa inválido.'
            });
        }

        const [result] = await pool.execute(`
            DELETE FROM tasks
            WHERE id = ? AND user_id = ?
        `, [taskId, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: 'Tarefa não encontrada para este usuário.'
            });
        }

        return res.status(200).json({
            message: 'Tarefa excluída com sucesso.',
            id: taskId
        });
    } catch (error) {
        console.error('Erro ao excluir tarefa:', error);

        return res.status(500).json({
            message: 'Erro interno ao excluir tarefa.'
        });
    }
});

export default router;
