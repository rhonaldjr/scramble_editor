// GET /api/configs/:name — serve a page config.

import { Router } from 'express';
import { readConfig } from '../configs.js';

const router = Router();

router.get('/:name', async (req, res) => {
  try {
    const config = await readConfig(req.params.name);
    if (!config) return res.status(404).json({ error: 'not found' });
    res.json(config);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
