import { setupServer } from 'msw/node';
import { supabaseHandlers } from './supabase-handlers';

export const server = setupServer(...supabaseHandlers);
