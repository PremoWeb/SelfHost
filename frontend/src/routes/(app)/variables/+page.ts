import type { PageLoad } from './$types';

interface Variable {
    id: string;
    key: string;
    value: string;
    isPublic: boolean;
}

export const load: PageLoad = async () => ({
    variables: [] as Variable[]
});
