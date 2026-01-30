// Core API types for SelfHost

export interface User {
	id: string;
	name: string;
	email: string;
	emailVerifiedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface Team {
	id: string;
	name: string;
	description: string | null;
	personalTeam: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface Project {
	/** UUID string from API (used in routes) */
	id: string;
	uuid: string;
	name: string;
	description: string | null;
	team_id: string;
	created_at: string;
	updated_at: string;
	/** Normalized for UI (from created_at) */
	createdAt?: string;
	environments?: Environment[];
	client?: { name: string } | null;
}

export interface Environment {
	id: number;
	uuid: string;
	name: string;
	description: string | null;
	project_id: number;
	created_at: string;
	updated_at: string;
	applications?: Application[];
	databases?: Database[];
	services?: Service[];
}

export interface Application {
	id: number;
	uuid: string;
	name: string;
	description: string | null;
	fqdn: string | null;
	status: ApplicationStatus;
	git_repository: string | null;
	git_branch: string | null;
	build_pack: string | null;
	environment_id: number;
	destination_id: number;
	created_at: string;
	updated_at: string;
}

export type ApplicationStatus = 
	| 'running' 
	| 'stopped' 
	| 'restarting' 
	| 'exited' 
	| 'degraded';

export interface Database {
	id: number;
	uuid: string;
	name: string;
	description: string | null;
	type: DatabaseType;
	status: string;
	environment_id: number;
	destination_id: number;
	created_at: string;
	updated_at: string;
}

export type DatabaseType = 
	| 'postgresql' 
	| 'mysql' 
	| 'mariadb' 
	| 'mongodb';

export interface Service {
	id: number;
	uuid: string;
	name: string;
	description: string | null;
	docker_compose: string | null;
	environment_id: number;
	destination_id: number;
	created_at: string;
	updated_at: string;
}

export interface Server {
	/** UUID string from API (used in routes and API calls) */
	id: string;
	uuid: string;
	name: string;
	description: string | null;
	ip: string;
	ipv6: string | null;
	port: number;
	user: string;
	status: ServerStatus;
	team_id: string;
	tags: string[] | null;
	privateKeyId: string | null;
	vpsProviderId?: string | null;
	providerName?: string | null;
	cloudflareTunnelHostname?: string | null;
	cloudflareAccessTokenId?: string | null;
	agentVersion?: string | null;
	agentChecksum?: string | null;
	agentInstalledAt?: string | number | null;
	agentKey?: string | null;
	proxyLastAppliedAt?: string | number | null;
	application_count?: number;
	database_count?: number;
	datacenter?: string | null;
	connectionType?: string;
	healthCpu?: number;
	healthMemory?: number;
	healthDisk?: number;
	healthUpdatedAt?: number | string | null;
	proxyType?: string;
	proxyStatus?: string;
	created_at: string;
	updated_at: string;
}

export type ServerStatus = 'online' | 'offline' | 'unreachable' | 'restarting' | 'waiting' | 'reinstalling';

export interface Deployment {
	id: number;
	uuid: string;
	status: DeploymentStatus;
	commit: string | null;
	commit_message: string | null;
	application_id: number;
	started_at: string;
	finished_at: string | null;
	created_at: string;
	updated_at: string;
}

export type DeploymentStatus = 
	| 'queued' 
	| 'in_progress' 
	| 'finished' 
	| 'failed' 
	| 'cancelled';

export interface Destination {
	id: number;
	uuid: string;
	name: string;
	network: string;
	server_id: number;
	created_at: string;
	updated_at: string;
}

export interface EnvironmentVariable {
	id: string;
	key: string;
	value: string;
	isBuildTime: boolean;
	isPreview: boolean;
	applicationId: string | null;
	createdAt: Date;
	updatedAt: Date;
}

// API Response types
export interface ApiResponse<T> {
	data: T;
	meta?: {
		timestamp: string;
		[key: string]: any;
	};
}

export interface PaginatedResponse<T> {
	data: T[];
	meta: {
		current_page: number;
		from: number;
		last_page: number;
		per_page: number;
		to: number;
		total: number;
	};
	links: {
		first: string;
		last: string;
		prev: string | null;
		next: string | null;
	};
}

export interface ApiError {
	message: string;
	errors?: Record<string, string[]>;
}

// Form types
export interface CreateProjectDto {
	name: string;
	description?: string;
	clientId?: string;
}

export interface UpdateProjectDto {
	name?: string;
	description?: string;
	clientId?: string | null;
}

export interface CreateApplicationDto {
	name: string;
	description?: string;
	git_repository?: string;
	git_branch?: string;
	build_pack?: string;
	destination_id: number;
}

export interface UpdateApplicationDto {
	name?: string;
	description?: string;
	git_repository?: string;
	git_branch?: string;
	build_pack?: string;
}

export interface CreateServerDto {
	name: string;
	description?: string;
	ip: string;
	port?: number;
	user?: string;
	private_key_id: number;
	tags?: string[];
	cloudflare_tunnel_hostname?: string | null;
	cloudflare_access_token_id?: string | null;
}

export interface UpdateServerDto {
	name?: string;
	description?: string | null;
	ip?: string;
	ipv6?: string | null;
	port?: number;
	user?: string;
	privateKeyId?: string | null;
	cloudflareTunnelHostname?: string | null;
	cloudflareAccessTokenId?: string | null;
	tags?: string[];
}

// WebSocket event types
export interface DeploymentEvent {
	deployment_uuid: string;
	status: DeploymentStatus;
	message?: string;
}

export interface ServerEvent {
	server_uuid: string;
	status: ServerStatus;
	message?: string;
}

export interface ApplicationEvent {
	application_uuid: string;
	status: ApplicationStatus;
	message?: string;
}
