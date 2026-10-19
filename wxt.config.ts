import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Albert Enhancer',
    description: 'Understand, plan, and compare NYU course schedules.',
    permissions: ['storage'],
    host_permissions: ['https://*.nyu.edu/*'],
  },
});
