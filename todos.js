const express = require('express');
const morgan = require('morgan');
const flash = require('express-flash');
const session = require('express-session');
const { body, validationResult } = require('express-validator');

const app = express();
const host = 'localhost';
const port = 3000;

const todoLists = require('./lib/seed-data');
const TodoList = require('./lib/todolist');
const { sortTodoLists, sortTodos } = require('./lib/sort');
const { runInNewContext } = require('vm');

const loadTodoList = todoListId => {
  return todoLists.find(todoList => todoList.id === todoListId);
};

const loadTodo = (todoListId, todoId) => {
  let todoList = loadTodoList(todoListId);
  if (!todoList) return undefined;

  return todoList.findById(todoId);
};

app.set('views', './views');
app.set('view engine', 'pug');

app.use(morgan('common'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: 'launch-school-todos-session-id',
  resave: false,
  saveUninitialized: true,
  secret: 'this is not very secure',
}));
app.use(flash());

app.use((req, res, next) => {
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

app.get('/lists', (req, res) => {
  res.render('lists', { 
    todoLists: sortTodoLists(todoLists),
    flash: res.locals.flash,
   });
});

app.get('/', (req, res) => {
  res.redirect('/lists');
});

app.get('/lists/new', (req, res) => {
  res.render('new-list');
});

app.post('/lists', 
  [
    body("todoListTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The list title is required.")
      .isLength({ max: 100 })
      .withMessage("List title must be between 1 and 100 characters.")
      .custom(title => {
        let duplicate = todoLists.find(list => list.title === title);
        return duplicate === undefined;
      })
      .withMessage("List title must be unique."),
  ],
  (req, res) => {
    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach(message => req.flash("error", message.msg));
      res.render("new-list", {
        flash: req.flash(),
        todoListTitle: req.body.todoListTitle,
      });
    } else {
      let title = req.body.todoListTitle;
      todoLists.push(new TodoList(title));
      req.flash("success", `The todo list ${title} has been created.`);
      res.redirect("/lists");
    }
  }
);

app.get('/lists/:todoListId', (req, res, next) => {
  let listId = Number(req.params.todoListId);
  let matchedList = loadTodoList(listId);

  if (matchedList) {
    res.render('list', {
      todoList: matchedList,
      todos: sortTodos(matchedList),
    });
  } else {
    next(new Error('Not found.'));
  }
});

app.post('/lists/:todoListId/todos/:todoId/toggle', (req, res, next) => {
  let todoListId = Number(req.params.todoListId);
  let todoId = Number(req.params.todoId);

  let todo = loadTodo(todoListId, todoId);
  let title = todo.title;

  if (todo) {
    if (todo.isDone()) {
      todo.markUndone();
      req.flash('success', `${title} marked not done!`);
    } else {
      todo.markDone();
      req.flash('success', `${title} marked done!`);
    }
    res.redirect(`/lists/${todoListId}`);
  } else {
    next(new Error('Not found.'));
  }
});

app.post('/lists/:todoListId/todos/:todoId/destroy', (req, res, next) => {
  let todoListId = Number(req.params.todoListId);
  let todoId = Number(req.params.todoId);
  let todoList = loadTodoList(todoListId);

  if (todoList) {
    let todo = loadTodo(todoListId, todoId);
    let idxOfTodo = todoList.findIndexOf(todo);
    todoList.removeAt(idxOfTodo);
    req.flash('success', `Removed ${todo.title}.`)
    res.redirect(`/lists/${todoListId}`);
  } else {
    next(new Error('Not found.'));
  }
});

app.use((err, req, res, _next) => {
  console.log(err);
  res.status(404).send(err.message);
});

app.listen(port, host, () => {
  console.log(`Todos is listening on port ${port} of ${host}`);
});