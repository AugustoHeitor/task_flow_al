import { Router } from 'express';
import pool from '../../database.js';

const router = Router();

router.get('/', async (req, res) => {
    try {
        const [users] = await pool.execute(`
            SELECT id, first_name, last_name, email, phone
            FROM users
            ORDER BY id DESC
        `);

        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Erro ao listar usuários.'
        });
    }
});

export default router;