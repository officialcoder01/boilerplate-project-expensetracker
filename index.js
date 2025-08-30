const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
   
app.use(cors());
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
  res.render('home', { userId: req.user ? req.user._id : null });
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true, useUnifiedTopology: true})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

const newSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true }
});

const newUser = mongoose.model('newUser', newSchema);

const expenseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'newUser', required: true },
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    description: { type: String },
    category: { type: String, required: true },
    date: { type: Date, default: Date.now }
});

const Expense = mongoose.model('Expense', expenseSchema);


// Create new user and redirect them to expenses.ejs
app.post('/api/users', async (req, res) => {
  try {
    const user = new newUser({ 
      username: req.body.username,
      email: req.body.email
    });

    await user.save();
    res.redirect(`/api/users/${user._id}/expenses`);
  } catch (error) {
    res.status(400).json({ error: 'Error creating user' });
    console.error(error)
  }
});

app.use('/api/users/:userId/expenses', async (req, res, next) => {
  const userId = req.params.userId || req.body.userId;
  if (userId) {
    try {
      const user = await newUser.findById(userId);
      
      if (user) {
        req.user = user;
      }
    } catch (err) {
      console.error('Middleware Error:', err);
    }
  }

  next();
});

app.get('/api/users/:userId/expenses', (req, res) => {
  const userId = req.user ? req.user._id : req.params.userId;
  res.render('expenses', { userId });
});

// Route to handle expense tracking
app.post('/api/users/:userId/expenses', async (req, res) => {
  try {
    const userId = req.body.userId;
    const getUser = await newUser.findById(userId);

    if (!getUser) {
      return res.status(404).send('User not found');
    }

    const expense = new Expense({
      userId: getUser._id,
      title: req.body.title,
      amount: req.body.amount,
      description: req.body.description,
      category: req.body.category,
      date: req.body.date ? Date(req.body.date) : new Date()
    });

    await expense.save();

    res.redirect(`/api/users/${getUser._id}/expenses/history`);
  } catch (error) {
    res.status(400).json({ error: 'Error creating expense' });
    console.error(error)
  }
});

app.get('/api/users/:userId/expenses/history', async (req, res) => {
  try {
    const userId = req.params.userId || (req.user && req.user._id);
    if (!userId) return res.status(400).send('User ID required');

    const expenses = await Expense.find({ userId }).sort({ date: -1 }).lean();

    // Add a formatted date field to avoid calling Date methods in the template
    expenses.forEach(e => {
      e.formattedDate = e.date ? new Date(e.date).toLocaleDateString() : '';
    });

    res.render('history', { expenses: expenses || [], userId });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
