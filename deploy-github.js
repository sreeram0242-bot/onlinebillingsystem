import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const distPath = '.temp-output/public';

console.log('Building project for GitHub Pages...');

// Safely try to clean any leftover .git folders to release locks
try {
    fs.rmSync(path.join(distPath, '.git'), { recursive: true, force: true });
} catch (e) {}

const viteConfigPath = path.join(process.cwd(), 'vite.config.ts');
const originalViteConfig = fs.readFileSync(viteConfigPath, 'utf-8');

try {
    const newConfig = originalViteConfig
        .replace('vite: {}', `vite: { base: '/OfferMonitor-Lovable-Final/' }`)
        .replace('tanstackStart: {', `nitro: { output: { dir: '.temp-output', publicDir: '.temp-output/public' } },\n  tanstackStart: {`);
    fs.writeFileSync(viteConfigPath, newConfig);
    execSync('npm run build', { stdio: 'inherit' });
} catch (error) {
    console.error('Build failed!', error);
    process.exit(1);
} finally {
    fs.writeFileSync(viteConfigPath, originalViteConfig);
}

if (!fs.existsSync(distPath)) {
    console.error(`Error: Build directory ${distPath} does not exist even after build.`);
    process.exit(1);
}

fs.writeFileSync(path.join(distPath, '.nojekyll'), '');

console.log('Deploying to GitHub Pages using plumbing to avoid file locks...');

try {
    // 1. Create a temporary index file
    const tempIndex = path.join(process.cwd(), '.git/temp_index');
    
    // 2. Add the public folder to the temporary index
    execSync(`git --git-dir=.git --work-tree=${distPath} add --all`, { 
        env: { ...process.env, GIT_INDEX_FILE: tempIndex },
        stdio: 'inherit' 
    });
    
    // 3. Write a tree from the index
    const tree = execSync('git write-tree', { 
        env: { ...process.env, GIT_INDEX_FILE: tempIndex },
        encoding: 'utf-8' 
    }).trim();
    
    // 4. Create a commit
    const commit = execSync(`git commit-tree ${tree} -m "Deploy to GitHub Pages"`, { 
        encoding: 'utf-8' 
    }).trim();
    
    // 5. Push the commit to the gh-pages branch forcefully!
    execSync(`git push -f origin ${commit}:refs/heads/gh-pages`, { stdio: 'inherit' });
    
    // 6. Cleanup temp index
    fs.unlinkSync(tempIndex);
    
    console.log('\\n✅ Successfully deployed to GitHub Pages! It will be live at https://sreeram0242-bot.github.io/OfferMonitor-Lovable-Final/ in a minute.');
} catch (error) {
    console.error('\\n❌ Deployment failed. Please ensure you are logged into GitHub and try again.');
}
