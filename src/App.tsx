/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React from 'react';
import { UserWarning } from './UserWarning';
import {
  USER_ID,
  getTodos,
  addTodo,
  deleteTodo,
  updateTodo,
} from './api/todos';
import { Todo } from './types/Todo';
import classNames from 'classnames';
import { FilterType } from './types/FilterType';

export enum ErrorMessage {
  LOAD_TODOS = 'Unable to load todos',
  ADD_TODO = 'Unable to add a todo',
  DELETE_TODO = 'Unable to delete a todo',
  UPDATE_TODO = 'Unable to update a todo',
  EMPTY_TITLE = 'Title should not be empty',
}

export const App: React.FC = () => {
  const [todos, setTodos] = React.useState<Todo[]>([]);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [filter, setFilter] = React.useState(FilterType.All);
  const activeTodos = todos.filter(todo => !todo.completed);
  const visibleTodos = todos.filter(todo => {
    switch (filter) {
      case FilterType.Active:
        return !todo.completed;

      case FilterType.Completed:
        return todo.completed;

      default:
        return true;
    }
  });

  const [query, setQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [tempTodo, setTempTodo] = React.useState<Todo | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [loadingTodoIds, setLoadingTodoIds] = React.useState<number[]>([]);
  const [editingTodoId, setEditingTodoId] = React.useState<number | null>(null);
  const [editingTitle, setEditingTitle] = React.useState('');
  const [, setIsTodosLoading] = React.useState(true);

  React.useEffect(() => {
    setIsTodosLoading(true);

    getTodos()
      .then(setTodos)
      .catch(() => {
        setErrorMessage(ErrorMessage.LOAD_TODOS);
      })
      .finally(() => {
        setIsTodosLoading(false);
      });
  }, []);

  React.useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timer = setTimeout(() => {
      setErrorMessage('');
    }, 3000);

    return () => clearTimeout(timer);
  }, [errorMessage]);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedTitle = query.trim();

    if (!trimmedTitle) {
      setErrorMessage(ErrorMessage.EMPTY_TITLE);

      return;
    }

    const temporaryTodo: Todo = {
      id: 0,
      title: trimmedTitle,
      completed: false,
      userId: USER_ID,
    };

    setTempTodo(temporaryTodo);
    setIsSubmitting(true);

    try {
      const createdTodo = await addTodo({
        title: trimmedTitle,
        completed: false,
        userId: USER_ID,
      });

      setTodos(current => [...current, createdTodo]);
      setQuery('');
    } catch {
      setErrorMessage(ErrorMessage.ADD_TODO);
    } finally {
      setTempTodo(null);
      setIsSubmitting(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  const preparedTodos = tempTodo ? [...visibleTodos, tempTodo] : visibleTodos;
  const completedTodos = todos.filter(todo => todo.completed);

  const handleDelete = async (id: number) => {
    setLoadingTodoIds(prev => [...prev, id]);

    try {
      await deleteTodo(id);

      setTodos(current => current.filter(todo => todo.id !== id));
    } catch {
      setErrorMessage(ErrorMessage.DELETE_TODO);
    } finally {
      setLoadingTodoIds(prev => prev.filter(todoId => todoId !== id));

      inputRef.current?.focus();
    }
  };

  const handleClearCompleted = async () => {
    const completed = todos.filter(todo => todo.completed);

    const promises = completed.map(todo => {
      setLoadingTodoIds(prev => [...prev, todo.id]);

      return deleteTodo(todo.id)
        .then(() => {
          setTodos(current => current.filter(t => t.id !== todo.id));
        })
        .catch(() => {
          setErrorMessage(ErrorMessage.DELETE_TODO);
        })
        .finally(() => {
          setLoadingTodoIds(prev => prev.filter(id => id !== todo.id));
        });
    });

    await Promise.allSettled(promises);

    inputRef.current?.focus();
  };

  const handleToggle = async (todo: Todo) => {
    setLoadingTodoIds(prev => [...prev, todo.id]);

    try {
      const updatedTodo = await updateTodo(todo.id, {
        completed: !todo.completed,
      });

      setTodos(current =>
        current.map(t => (t.id === todo.id ? updatedTodo : t)),
      );
    } catch {
      setErrorMessage(ErrorMessage.UPDATE_TODO);
    } finally {
      setLoadingTodoIds(prev => prev.filter(id => id !== todo.id));
    }
  };

  const handleToggleAll = async () => {
    const newStatus = activeTodos.length > 0;

    const todosToUpdate = todos.filter(todo => todo.completed !== newStatus);

    await Promise.all(
      todosToUpdate.map(async todo => {
        setLoadingTodoIds(prev => [...prev, todo.id]);

        try {
          const updatedTodo = await updateTodo(todo.id, {
            completed: newStatus,
          });

          setTodos(current =>
            current.map(t => (t.id === todo.id ? updatedTodo : t)),
          );
        } catch {
          setErrorMessage(ErrorMessage.UPDATE_TODO);
        } finally {
          setLoadingTodoIds(prev => prev.filter(id => id !== todo.id));
        }
      }),
    );
  };

  const handleRename = async (todo: Todo) => {
    const trimmedTitle = editingTitle.trim();

    if (trimmedTitle === todo.title) {
      setEditingTodoId(null);

      return;
    }

    if (!trimmedTitle) {
      handleDelete(todo.id);

      return;
    }

    setLoadingTodoIds(prev => [...prev, todo.id]);

    try {
      const updatedTodo = await updateTodo(todo.id, {
        title: trimmedTitle,
      });

      setTodos(current =>
        current.map(t => (t.id === todo.id ? updatedTodo : t)),
      );

      setEditingTodoId(null);
    } catch {
      setErrorMessage(ErrorMessage.UPDATE_TODO);
    } finally {
      setLoadingTodoIds(prev => prev.filter(id => id !== todo.id));
    }
  };

  if (!USER_ID) {
    return <UserWarning />;
  }

  const handleRenameSubmit = (
    event: React.FormEvent<HTMLFormElement>,
    todo: Todo,
  ) => {
    event.preventDefault();
    handleRename(todo);
  };

  const handleEditKeyUp = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setEditingTodoId(null);
    }
  };

  const handleStartEditing = (todo: Todo) => {
    setEditingTodoId(todo.id);
    setEditingTitle(todo.title);
  };

  const FILTERS = [
    {
      label: 'All',
      value: FilterType.All,
      href: '#/',
      dataCy: 'FilterLinkAll',
    },
    {
      label: 'Active',
      value: FilterType.Active,
      href: '#/active',
      dataCy: 'FilterLinkActive',
    },
    {
      label: 'Completed',
      value: FilterType.Completed,
      href: '#/completed',
      dataCy: 'FilterLinkCompleted',
    },
  ];

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <header className="todoapp__header">
          {todos.length > 0 && (
            <button
              type="button"
              data-cy="ToggleAllButton"
              onClick={handleToggleAll}
              className={classNames('todoapp__toggle-all', {
                active: activeTodos.length === 0,
              })}
            />
          )}

          {/* Add a todo on form submit */}
          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              data-cy="NewTodoField"
              type="text"
              className="todoapp__new-todo"
              placeholder="What needs to be done?"
              value={query}
              onChange={event => setQuery(event.target.value)}
              disabled={isSubmitting}
            />
          </form>
        </header>

        <section className="todoapp__main" data-cy="TodoList">
          {preparedTodos.map(todo => {
            const isLoading = todo.id === 0 || loadingTodoIds.includes(todo.id);

            return (
              <div
                key={todo.id}
                data-cy="Todo"
                className={classNames('todo', {
                  completed: todo.completed,
                })}
              >
                <label className="todo__status-label">
                  <input
                    data-cy="TodoStatus"
                    type="checkbox"
                    className="todo__status"
                    checked={todo.completed}
                    onChange={() => handleToggle(todo)}
                  />
                </label>

                {editingTodoId === todo.id ? (
                  <form onSubmit={e => handleRenameSubmit(e, todo)}>
                    <input
                      data-cy="TodoTitleField"
                      type="text"
                      className="todo__title-field"
                      value={editingTitle}
                      onChange={e => setEditingTitle(e.target.value)}
                      onBlur={() => handleRename(todo)}
                      onKeyUp={handleEditKeyUp}
                      autoFocus
                    />
                  </form>
                ) : (
                  <span
                    data-cy="TodoTitle"
                    className="todo__title"
                    onDoubleClick={() => {
                      handleStartEditing(todo);
                    }}
                  >
                    {todo.title}
                  </span>
                )}

                {editingTodoId !== todo.id && (
                  <button
                    type="button"
                    className="todo__remove"
                    data-cy="TodoDelete"
                    onClick={() => handleDelete(todo.id)}
                  >
                    ×
                  </button>
                )}

                <div
                  data-cy="TodoLoader"
                  className={classNames('modal overlay', {
                    hidden: !isLoading,
                    'is-active': isLoading,
                  })}
                >
                  <div className="loader" />
                </div>
              </div>
            );
          })}
        </section>

        {/* Hide the footer if there are no todos */}
        {todos.length > 0 && (
          <footer className="todoapp__footer" data-cy="Footer">
            <span className="todo-count" data-cy="TodosCounter">
              {activeTodos.length} items left
            </span>

            <nav className="filter" data-cy="Filter">
              {FILTERS.map(({ label, value, href, dataCy }) => (
                <a
                  key={value}
                  href={href}
                  data-cy={dataCy}
                  className={classNames('filter__link', {
                    selected: filter === value,
                  })}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </a>
              ))}
            </nav>

            <button
              type="button"
              className="todoapp__clear-completed"
              data-cy="ClearCompletedButton"
              disabled={completedTodos.length === 0}
              onClick={handleClearCompleted}
            >
              Clear completed
            </button>
          </footer>
        )}
      </div>

      {/* DON'T use conditional rendering to hide the notification */}
      {/* Add the 'hidden' class to hide the message smoothly */}
      <div
        data-cy="ErrorNotification"
        className={classNames(
          'notification',
          'is-danger',
          'is-light',
          'has-text-weight-normal',
          {
            hidden: !errorMessage,
          },
        )}
      >
        <button
          data-cy="HideErrorButton"
          type="button"
          className="delete"
          onClick={() => setErrorMessage('')}
        />
        {/* show only one message at a time */}
        {errorMessage}
      </div>
    </div>
  );
};
