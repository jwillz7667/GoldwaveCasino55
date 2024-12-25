import loginHTML from '../../components/login.html';
import registerHTML from '../../components/register.html';
import { api } from '../services/api';

export const initAuth = () => {
  // Add modals to the DOM
  document.body.insertAdjacentHTML('beforeend', loginHTML);
  document.body.insertAdjacentHTML('beforeend', registerHTML);

  const loginModal = document.getElementById('login-modal');
  const registerModal = document.getElementById('register-modal');

  // Show modals
  document.querySelector('.login-btn').addEventListener('click', () => {
    loginModal.style.display = 'flex';
  });

  document.querySelector('.signup-btn').addEventListener('click', () => {
    registerModal.style.display = 'flex';
  });

  // Close modals
  document.getElementById('close-login').addEventListener('click', () => {
    loginModal.style.display = 'none';
  });

  document.getElementById('close-register').addEventListener('click', () => {
    registerModal.style.display = 'none';
  });

  // Switch between modals
  document.getElementById('switch-to-register').addEventListener('click', () => {
    loginModal.style.display = 'none';
    registerModal.style.display = 'flex';
  });

  document.getElementById('switch-to-login').addEventListener('click', () => {
    registerModal.style.display = 'none';
    loginModal.style.display = 'flex';
  });

  // Handle form submissions
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
      const response = await api.login({ email, password });
      if (response.token) {
        localStorage.setItem('token', response.token);
        loginModal.style.display = 'none';
        updateUIForLoggedInUser();
      } else {
        alert(response.error || 'Login failed');
      }
    } catch (error) {
      alert('Login failed. Please try again.');
    }
  });

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    if (password !== confirmPassword) {
      alert('Passwords do not match!');
      return;
    }

    try {
      const response = await api.register({ username, email, password });
      if (response.token) {
        localStorage.setItem('token', response.token);
        registerModal.style.display = 'none';
        updateUIForLoggedInUser();
      } else {
        alert(response.error || 'Registration failed');
      }
    } catch (error) {
      alert('Registration failed. Please try again.');
    }
  });

  // Close modals when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === loginModal) {
      loginModal.style.display = 'none';
    }
    if (e.target === registerModal) {
      registerModal.style.display = 'none';
    }
  });

  // Check if user is already logged in
  const token = localStorage.getItem('token');
  if (token) {
    updateUIForLoggedInUser();
  }
};

const updateUIForLoggedInUser = async () => {
  try {
    const profile = await api.getProfile();
    
    // Update header buttons
    const authButtons = document.querySelector('.auth-buttons');
    authButtons.innerHTML = `
      <span class="user-balance">Balance: $${profile.balance}</span>
      <button class="profile-btn">Profile</button>
      <button class="logout-btn">Logout</button>
    `;

    // Add event listeners for new buttons
    document.querySelector('.logout-btn').addEventListener('click', () => {
      localStorage.removeItem('token');
      window.location.reload();
    });

    document.querySelector('.profile-btn').addEventListener('click', () => {
      showProfileModal(profile);
    });
  } catch (error) {
    console.error('Error updating UI:', error);
  }
};

const showProfileModal = (profile) => {
  const profileModal = document.createElement('div');
  profileModal.className = 'auth-modal';
  profileModal.id = 'profile-modal';
  
  profileModal.innerHTML = `
    <div class="auth-modal-content">
      <h2>Profile</h2>
      <div class="profile-info">
        <p><strong>Username:</strong> ${profile.username}</p>
        <p><strong>Email:</strong> ${profile.email}</p>
        <p><strong>Balance:</strong> $${profile.balance}</p>
        <p><strong>VIP Status:</strong> ${profile.vip_status}</p>
        <p><strong>Total Winnings:</strong> $${profile.total_winnings}</p>
        <p><strong>Total Losses:</strong> $${profile.total_losses}</p>
      </div>
      <button class="close-modal" id="close-profile">&times;</button>
    </div>
  `;

  document.body.appendChild(profileModal);
  profileModal.style.display = 'flex';

  document.getElementById('close-profile').addEventListener('click', () => {
    profileModal.remove();
  });

  profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) {
      profileModal.remove();
    }
  });
}; 