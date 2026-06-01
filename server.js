const express = require('express');
const cors = require('cors');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let db;

// Inicializa o Banco de Dados Centralizado
(async () => {
    db = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    // Criação das Tabelas
    await db.exec(`
        CREATE TABLE IF NOT EXISTS usuarios (
            usuario TEXT PRIMARY KEY,
            senha TEXT,
            cargo TEXT
        );
        CREATE TABLE IF NOT EXISTS produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            preco REAL,
            estoque INTEGER
        );
        CREATE TABLE IF NOT EXISTS vendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT,
            timestamp INTEGER,
            operador TEXT,
            itens TEXT,
            formaPagamento TEXT,
            total REAL
        );
        CREATE TABLE IF NOT EXISTS comandas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            identificador TEXT,
            itens TEXT,
            total REAL
        );
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hora TEXT,
            txt TEXT
        );
    `);

    // Insere o admin padrão se a tabela de usuários estiver vazia
    const adminExiste = await db.get('SELECT * FROM usuarios WHERE usuario = "admin"');
    if (!adminExiste) {
        await db.run('INSERT INTO usuarios (usuario, senha, cargo) VALUES ("admin", "123", "Gerente")');
    }

    console.log('🏁 Banco de Dados SQLite pronto e conectado!');
})();

// ================= ROTAS DE USUÁRIOS =================
app.get('/api/usuarios', async (req, res) => {
    const lista = await db.all('SELECT usuario, cargo FROM usuarios');
    res.json(lista);
});

app.post('/api/login', async (req, res) => {
    const { usuario, senha } = req.body;
    const user = await db.get('SELECT * FROM usuarios WHERE LOWER(usuario) = ?', [usuario.toLowerCase()]);
    if (!user) return res.status(404).json({ erro: 'Usuário não encontrado' });
    if (user.senha !== senha) return res.status(401).json({ erro: 'Senha incorreta' });
    res.json({ usuario: user.usuario, cargo: user.cargo });
});

app.post('/api/usuarios', async (req, res) => {
    const { usuario, senha, cargo } = req.body;
    await db.run('INSERT OR REPLACE INTO usuarios (usuario, senha, cargo) VALUES (?, ?, ?)', [usuario, senha, cargo]);
    res.json({ sucesso: true });
});

app.delete('/api/usuarios/:id', async (req, res) => {
    if(req.params.id === 'admin') return res.status(400).json({ erro: 'Não pode apagar o admin' });
    await db.run('DELETE FROM usuarios WHERE usuario = ?', [req.params.id]);
    res.json({ sucesso: true });
});

// ================= ROTAS DE PRODUTOS =================
app.get('/api/produtos', async (req, res) => {
    const lista = await db.all('SELECT * FROM produtos');
    res.json(lista);
});

app.post('/api/produtos', async (req, res) => {
    const { id, nome, preco, estoque } = req.body;
    if (id) {
        await db.run('UPDATE produtos SET nome = ?, preco = ?, estoque = ? WHERE id = ?', [nome, preco, estoque, id]);
    } else {
        await db.run('INSERT INTO produtos (nome, preco, estoque) VALUES (?, ?, ?)', [nome, preco, estoque]);
    }
    res.json({ sucesso: true });
});

app.delete('/api/produtos/:id', async (req, res) => {
    await db.run('DELETE FROM produtos WHERE id = ?', [req.params.id]);
    res.json({ sucesso: true });
});

// ================= ROTAS DE VENDAS =================
app.get('/api/vendas', async (req, res) => {
    const lista = await db.all('SELECT * FROM vendas');
    // Converte os itens de String de volta para Objeto/Array
    const formatada = lista.map(v => ({ ...v, itens: JSON.parse(v.itens) }));
    res.json(formatada);
});

app.post('/api/vendas', async (req, res) => {
    const { data, timestamp, operador, itens, formaPagamento, total } = req.body;
    
    // Insere a venda
    await db.run(
        'INSERT INTO vendas (data, timestamp, operador, itens, formaPagamento, total) VALUES (?, ?, ?, ?, ?, ?)',
        [data, timestamp, operador, JSON.stringify(itens), formaPagamento, total]
    );

    // Atualiza o estoque de cada item vendido automaticamente no servidor
    for (const item of itens) {
        await db.run('UPDATE produtos SET estoque = estoque - ? WHERE id = ?', [item.qtd, item.id]);
    }

    res.json({ sucesso: true });
});

app.delete('/api/vendas', async (req, res) => {
    await db.run('DELETE FROM vendas');
    res.json({ sucesso: true });
});

// ================= ROTAS DE COMANDAS =================
app.get('/api/comandas', async (req, res) => {
    const lista = await db.all('SELECT * FROM comandas');
    res.json(lista.map(c => ({ ...c, itens: JSON.parse(c.itens) })));
});

app.post('/api/comandas', async (req, res) => {
    const { id, identificador, itens, total } = req.body;
    if (id || id === 0) {
        await db.run('UPDATE comandas SET itens = ?, total = ? WHERE id = ?', [JSON.stringify(itens), total, id]);
    } else {
        await db.run('INSERT INTO comandas (identificador, itens, total) VALUES (?, ?, ?)', [identificador, JSON.stringify(itens), total]);
    }
    res.json({ sucesso: true });
});

app.delete('/api/comandas/:id', async (req, res) => {
    await db.run('DELETE FROM comandas WHERE id = ?', [req.params.id]);
    res.json({ sucesso: true });
});

// ================= ROTAS DE LOGS =================
app.get('/api/logs', async (req, res) => {
    const lista = await db.all('SELECT * FROM logs');
    res.json(lista);
});

app.post('/api/logs', async (req, res) => {
    const { hora, txt } = req.body;
    await db.run('INSERT INTO logs (hora, txt) VALUES (?, ?)', [hora, txt]);
    res.json({ sucesso: true });
});

// Inicia o Servidor na porta 3000
// Configuração adaptativa para a Nuvem
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor ativo na porta ${PORT}`);
});