import{defineConfig}from'vite';import{fileURLToPath,URL}from'node:url';
export default defineConfig({base:'/',build:{sourcemap:false,rollupOptions:{input:{bridge:fileURLToPath(new URL('./bridge.html',import.meta.url)),identity:fileURLToPath(new URL('./identity.html',import.meta.url))}}}});
