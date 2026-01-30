import { writable } from 'svelte/store';
import type { User, Team } from '$lib/types';

interface AuthState {
	user: User | null;
	team: Team | null;
	isAuthenticated: boolean;
	isLoading: boolean;
}

/**
 * Authentication store
 * 
 * Manages the current user and authentication state
 */
function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>({
		user: null,
		team: null,
		isAuthenticated: false,
		isLoading: true
	});

	return {
		subscribe,

		/**
		 * Set the authenticated user and team
		 */
		setUser: (user: User, team: Team) =>
			update((state) => ({
				...state,
				user,
				team,
				isAuthenticated: true,
				isLoading: false
			})),

		/**
		 * Clear authentication (logout)
		 */
		logout: () =>
			set({
				user: null,
				team: null,
				isAuthenticated: false,
				isLoading: false
			}),

		/**
		 * Set loading state
		 */
		setLoading: (isLoading: boolean) =>
			update((state) => ({
				...state,
				isLoading
			})),

		/**
		 * Update user data
		 */
		updateUser: (userData: Partial<User>) =>
			update((state) => ({
				...state,
				user: state.user ? { ...state.user, ...userData } : null
			})),

		/**
		 * Update team data
		 */
		updateTeam: (teamData: Partial<Team>) =>
			update((state) => ({
				...state,
				team: state.team ? { ...state.team, ...teamData } : null
			}))
	};
}

export const authStore = createAuthStore();
