import './App.css';
import React, { useState, createContext, useContext, useEffect, useCallback } from 'react';

// WAŻNE: Wklej tutaj publiczny adres URL swojego serwera z Render!
// Pamiętaj, żeby na końcu było "/api"
const API_URL = 'https://serwer-for-render.onrender.com/api';

// --- Kontekst i Provider (dostawca stanu) ---
// Teraz nasz kontekst będzie zarządzał wszystkimi danymi
const AppContext = createContext(null);

const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Funkcja do pobierania użytkowników
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/users`);
      if (!res.ok) throw new Error('Błąd pobierania użytkowników');
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error(error);
      setUsers([]); // W razie błędu ustaw pustą tablicę
    }
  }, []);

  // Funkcja do pobierania zadań
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/tasks`);
      if (!res.ok) throw new Error('Błąd pobierania zadań');
      const data = await res.json();
      setTasks(data);
    } catch (error) {
      console.error(error);
      setTasks([]); // W razie błędu ustaw pustą tablicę
    }
  }, []);

  // Pobierz wszystkie dane przy pierwszym załadowaniu aplikacji
  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      // Używamy Promise.all, aby pobrać dane użytkowników i zadań równolegle
      await Promise.all([fetchUsers(), fetchTasks()]);
      setIsLoading(false);
    };
    fetchAllData();
  }, [fetchUsers, fetchTasks]);

  // NOWA, BEZPIECZNA FUNKCJA LOGOWANIA
  const login = async (username, password) => {
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) { // Serwer zwrócił błąd (np. 401 Unauthorized)
        return false;
      }
      const loggedInUser = await res.json();
      setUser(loggedInUser);
      return true;
    } catch (error) {
      console.error("Błąd logowania:", error);
      return false;
    }
  };

  const logout = () => setUser(null);

  const deleteUser = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/users/${userId}`, 
        {method: 'DELETE',
      });

      if (!res.ok){
        throw new Error('Nie udało się usunąć użytkownika.');
      }
      fetchUsers();
    } catch (error) {
      console.error("Błąd podczas usuwania użytkownika: ", error);
    }
  };

 
  const deleteTask = async (taskId) => {
    try {
      const res = await fetch(`${API_URL}/tasks/${taskId}`,
        {method: 'DELETE',
      });

      if (!res.ok){
        throw new Error('Nie udało się usunąć zadania.');
      }
      fetchTasks();
    } catch (error) {
      console.error("Błąd podczas usuwania zadania: ", error);
    }
  };

  // Udostępniamy wszystkie potrzebne dane i funkcje w kontekście
  const value = { user, users, tasks, login, logout, isLoading, fetchUsers, fetchTasks, deleteUser, deleteTask };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// Hook do łatwego używania kontekstu
const useAppData = () => useContext(AppContext);

// --- Główny komponent aplikacji ---
export default function App() {
  return (
    <AppProvider>
      <Main />
    </AppProvider>
  );
}

function Main() {
  const { user, isLoading } = useAppData();
  if (isLoading) {
    return <div className="login-page-container"><div className="login-form-container"><h2>Ładowanie danych...</h2></div></div>;
  }
  return user ? <Dashboard /> : <LoginPage />;
}

// --- Komponenty (logowanie, panele, etc.) ---

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAppData();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const success = await login(username, password);
    if (!success) {
      setError('Nieprawidłowa nazwa użytkownika lub hasło.');
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-form-container">
        <h2>Logowanie</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Nazwa użytkownika</label>
            <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="input-field" required />
          </div>
          <div className="form-group">
            <label htmlFor="password">Hasło</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" required />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="btn btn-primary submit-btn">Zaloguj</button>
        </form>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user, logout } = useAppData();
  const renderDashboard = () => {
    switch (user.role) {
      case 'szef':
      case 'kierownik':
        return <BossDashboard />;
      case 'pracownik':
        return <EmployeeDashboard />;
      default:
        return <div>Nieznana rola użytkownika.</div>;
    }
  };
  return (
    <div>
      <nav className="navbar">
        <h1>System Zarządzania</h1>
        <div className="user-info">
          <span>Zalogowano jako: <span className="username">{user.username} ({user.role})</span></span>
          <button onClick={logout} className="btn btn-secondary">Wyloguj</button>
        </div>
      </nav>
      <main className="main-content">{renderDashboard()}</main>
    </div>
  );
}

function EmployeeDashboard() {
  const { user, tasks, fetchTasks } = useAppData(); // Pobieramy zadania i funkcję do ich odświeżania z kontekstu
  const myTasks = tasks.filter(task => task.assignedTo === user.id);

  // NOWA, POPRAWNA FUNKCJA DODAWANIA KOMENTARZA
  const addComment = async (taskId, commentText, status) => {
    try {
      await fetch(`${API_URL}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: taskId,
          author: user.username,
          text: commentText,
          status: status,
        }),
      });
      // Po dodaniu komentarza, odśwież listę zadań, aby zobaczyć zmiany
      fetchTasks();
    } catch (error) {
      console.error("Błąd dodawania komentarza:", error);
    }
  };

  return (
    <div>
      <h2>Moje zadania</h2>
      {myTasks.length > 0 ? myTasks.map(task => <TaskView key={task.id} task={task} onAddComment={addComment} />) : <p>Nie masz przypisanych żadnych zadań.</p>}
    </div>
  );
}

function TaskView({ task, onAddComment }) {
    const [comment, setComment] = useState('');
    const [status, setStatus] = useState('normal');
    const handleAddComment = () => {
        if (comment.trim()) {
            onAddComment(task.id, comment, status);
            setComment('');
            setStatus('normal');
        }
    };
    return (
        <div className="card">
            <h3>{task.title}</h3>
            <div className="task-details"><p>Termin: {new Date(task.deadline).toLocaleString('pl-PL')}</p></div>
            <div className="comments-section">
                <h4>Komentarze:</h4>
                {task.comments.length > 0 ? (
                    <div>{task.comments.map((c) => <div key={c.id} className={`comment ${c.status === 'ważne' ? 'status-ważne' : 'status-normal'}`}><p className="comment-author">{c.by}:</p><p>{c.text}</p></div>)}</div>
                ) : <p>Brak komentarzy.</p>}
            </div>
            <div className="add-comment-section">
                <h4>Dodaj nowy komentarz:</h4>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} className="input-field" placeholder="Wpisz swój komentarz..."></textarea>
                <div className="important-checkbox">
                    <input type="checkbox" id={`status-${task.id}`} checked={status === 'ważne'} onChange={(e) => setStatus(e.target.checked ? 'ważne' : 'normal')} />
                    <label htmlFor={`status-${task.id}`}>Oznacz jako ważne</label>
                </div>
                <button onClick={handleAddComment} className="btn btn-primary">Dodaj komentarz</button>
            </div>
        </div>
    );
}

function BossDashboard() {
  const [view, setView] = useState('tasks');
  // Pobieramy wszystko z głównego kontekstu, nie trzymamy już stanu lokalnie
  const { tasks, fetchTasks, fetchUsers, deleteTask } = useAppData();

  const addTask = async (newTaskData) => {
    await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTaskData),
    });
    fetchTasks(); // Odśwież listę zadań
  };

  const addUser = async (newUserData) => {
    await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUserData),
    });
    fetchUsers(); // Odśwież listę użytkowników
  };

  return (
    <div>
      <nav className="dashboard-nav">
        <button onClick={() => setView('tasks')} className={view === 'tasks' ? 'active' : ''}>Zadania</button>
        <button onClick={() => setView('users')} className={view === 'users' ? 'active' : ''}>Zarządzaj użytkownikami</button>
        <button onClick={() => setView('stats')} className={view === 'stats' ? 'active' : ''}>Statystyki</button>
      </nav>
      {view === 'tasks' && <BossTaskView tasks={tasks} onAddTask={addTask} onDeleteTask={deleteTask} />}
      {view === 'users' && <UserManagement onAddUser={addUser} />}
      {view === 'stats' && <StatisticsPage />}
    </div>
  );
}

// Pozostałe komponenty (BossTaskView, CreateTaskForm, UserManagement, StatisticsPage)
// pozostają bez większych zmian, ponieważ ich logika jest już poprawna.
// Poniżej wklejam je dla kompletności.

function BossTaskView({ tasks, onAddTask, onDeleteTask }) {
    const [showCreateForm, setShowCreateForm] = useState(false);
    const { users } = useAppData();
    const getUsernameById = (id) => users.find(u => u.id === id)?.username || 'Nieznany';
    return (
        <div>
            <div className="task-header">
                <h2>Wszystkie zadania</h2>
                <button onClick={() => setShowCreateForm(!showCreateForm)} className="btn btn-primary">{showCreateForm ? 'Anuluj' : 'Utwórz nowe zadanie'}</button>
            </div>
            {showCreateForm && <CreateTaskForm onAddTask={onAddTask} />}
            {tasks.map(task => (
                <div key={task.id} className="card">
                    <h3>{task.title}</h3>
                    <div className="task-details">
                        <p>Przypisano do: <span className="assigned-to">{getUsernameById(task.assignedTo)}</span></p>
                        <p>Termin: {new Date(task.deadline).toLocaleString('pl-PL')}</p>
                    </div>
                    <div className="comments-section">
                        <h4>Komentarze:</h4>
                        {task.comments.length > 0 ? (
                            <div>{task.comments.map((c) => <div key={c.id} className={`comment ${c.status === 'ważne' ? 'status-ważne' : 'status-normal'}`}><p className="comment-author">{c.by}:</p><p>{c.text}</p></div>)}</div>
                        ) : <p>Brak komentarzy.</p>}
                    </div>
                    <button onClick={() => onDeleteTask(task.id)} className='btn btn-danger delete-task-btn'>Usuń zadanie</button>
                </div>
            ))}
        </div>
    );
}

function CreateTaskForm({ onAddTask }) {
    const [title, setTitle] = useState('');
    const [assignedTo, setAssignedTo] = useState('');
    const [deadline, setDeadline] = useState('');
    const { users } = useAppData();
    const employees = users.filter(u => u.role === 'pracownik');
    const handleSubmit = (e) => {
        e.preventDefault();
        if (title && assignedTo && deadline) {
            // ID jest generowane przez bazę, więc go nie wysyłamy
            onAddTask({ id: Date.now(), title, assignedTo: parseInt(assignedTo), deadline });
            setTitle(''); setAssignedTo(''); setDeadline('');
        }
    };
    return (
        <div className="card">
            <h3>Nowe zadanie</h3>
            <form onSubmit={handleSubmit}>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Tytuł zadania" className="input-field" required />
                <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className="input-field" required>
                    <option value="">Wybierz pracownika</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.username} ({emp.subRole})</option>)}
                </select>
                <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} className="input-field" required />
                <button type="submit" className="btn btn-primary">Dodaj zadanie</button>
            </form>
        </div>
    );
}

function UserManagement({ onAddUser }) {
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('pracownik');
    const [subRole, setSubRole] = useState('laserownia');
    const { users, deleteUser, user: loggedInUser } = useAppData();

    const handleSubmit = (e) => {
        e.preventDefault();
        // ID jest generowane przez bazę, więc go nie wysyłamy
        const newUser = { id: Date.now(), username, password, role };
        if (role === 'pracownik') newUser.subRole = subRole;
        onAddUser(newUser);
        setUsername(''); setPassword(''); setRole('pracownik'); setSubRole('laserownia');
        setShowCreateForm(false);
    };
    return (
        <div>
            <div className="task-header">
                <h2>Użytkownicy</h2>
                <button onClick={() => setShowCreateForm(!showCreateForm)} className="btn btn-primary">{showCreateForm ? 'Anuluj' : 'Dodaj użytkownika'}</button>
            </div>
            {showCreateForm && (
                <div className="card">
                    <h3>Nowy użytkownik</h3>
                    <form onSubmit={handleSubmit}>
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Nazwa użytkownika" className="input-field" required />
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Hasło" className="input-field" required />
                        <select value={role} onChange={e => setRole(e.target.value)} className="input-field" required>
                            <option value="pracownik">Pracownik</option>
                            <option value="kierownik">Kierownik</option>
                        </select>
                        {role === 'pracownik' && (
                            <select value={subRole} onChange={e => setSubRole(e.target.value)} className="input-field" required>
                                <option value="laserownia">Laserownia</option>
                                <option value="marketing">Marketing</option>
                                <option value="grafik">Grafik</option>
                            </select>
                        )}
                        <button type="submit" className="btn btn-primary">Utwórz użytkownika</button>
                    </form>
                </div>
            )}
            <div className="card">
                <ul className="user-list">
                    {users.map(u => 
                        (loggedInUser.id !== u.id &&(
                            <li key={u.id} className="user-list-item">
                                <span>{u.username}</span><span className="role">{u.role} {u.subRole && `(${u.subRole})`}</span>
                                <button onClick={() => deleteUser(u.id)} className='btn btn-danger'>Usuń</button>
                            </li>
                        )
                    ))}
                </ul>
            </div>
        </div>
    );
}

function StatisticsPage() {
    return (
        <div className="card">
            <h2>Statystyki Sprzedaży</h2>
            <p>Ta strona jest w budowie. W przyszłości pojawią się tutaj wykresy i dane dotyczące sprzedaży.</p>
        </div>
    );
}