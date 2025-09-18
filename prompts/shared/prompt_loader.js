// УНИВЕРСАЛЬНЫЙ ЗАГРУЗЧИК ПРОМПТОВ
// Используется во всех скриптах для загрузки промптов из централизованной папки

const path = require('path');

class PromptLoader {
    constructor() {
        this.promptsBasePath = path.resolve(__dirname, '..');
        this.cache = new Map();
    }

    // Загрузить промпт по категории и имени
    load(category, promptName) {
        const cacheKey = `${category}/${promptName}`;

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const promptPath = path.join(this.promptsBasePath, category, `${promptName}.js`);
            delete require.cache[require.resolve(promptPath)];
            const promptModule = require(promptPath);

            // Ищем нужный промпт в модуле
            const prompt = this.findPromptInModule(promptModule, promptName);

            if (!prompt) {
                throw new Error(`Prompt '${promptName}' not found in module '${category}/${promptName}.js'`);
            }

            this.cache.set(cacheKey, prompt);
            return prompt;
        } catch (error) {
            console.error(`❌ Failed to load prompt ${category}/${promptName}:`, error.message);
            throw error;
        }
    }

    // Найти промпт в модуле по имени
    findPromptInModule(module, promptName) {
        // Пробуем разные варианты именования
        const possibleNames = [
            promptName.toUpperCase(),
            promptName.toLowerCase(),
            this.toCamelCase(promptName),
            this.toSnakeCase(promptName)
        ];

        for (const name of possibleNames) {
            if (module[name]) {
                return module[name];
            }
        }

        // Если не нашли, возвращаем первый экспортированный промпт
        const exports = Object.keys(module);
        if (exports.length === 1) {
            return module[exports[0]];
        }

        return null;
    }

    // Загрузить все промпты из категории
    loadCategory(category) {
        try {
            const categoryPath = path.join(this.promptsBasePath, category);
            const fs = require('fs');

            if (!fs.existsSync(categoryPath)) {
                throw new Error(`Category '${category}' not found`);
            }

            const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));
            const prompts = {};

            for (const file of files) {
                const promptName = file.replace('.js', '');
                try {
                    prompts[promptName] = this.load(category, promptName);
                } catch (error) {
                    console.warn(`⚠️ Failed to load ${category}/${promptName}: ${error.message}`);
                }
            }

            return prompts;
        } catch (error) {
            console.error(`❌ Failed to load category '${category}':`, error.message);
            throw error;
        }
    }

    // Заменить переменные в промпте
    renderPrompt(promptTemplate, variables = {}) {
        let rendered = promptTemplate;

        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`\\{${key}\\}`, 'g');
            rendered = rendered.replace(regex, value);
        }

        return rendered;
    }

    // Утилиты для именования
    toCamelCase(str) {
        return str.replace(/_(\w)/g, (_, letter) => letter.toUpperCase());
    }

    toSnakeCase(str) {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }

    // Очистить кеш
    clearCache() {
        this.cache.clear();
    }

    // Получить список доступных категорий
    getAvailableCategories() {
        const fs = require('fs');
        return fs.readdirSync(this.promptsBasePath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
    }

    // Получить список промптов в категории
    getPromptsInCategory(category) {
        const fs = require('fs');
        const categoryPath = path.join(this.promptsBasePath, category);

        if (!fs.existsSync(categoryPath)) {
            return [];
        }

        return fs.readdirSync(categoryPath)
            .filter(f => f.endsWith('.js'))
            .map(f => f.replace('.js', ''));
    }
}

// Создаём синглтон
const promptLoader = new PromptLoader();

// Удобные хелперы
const loadPrompt = (category, name, variables = {}) => {
    const template = promptLoader.load(category, name);
    return variables ? promptLoader.renderPrompt(template, variables) : template;
};

const loadQCIPrompt = (name, variables = {}) => loadPrompt('qci_analysis', name, variables);
const loadOptimizationPrompt = (name, variables = {}) => loadPrompt('optimization', name, variables);

module.exports = {
    PromptLoader,
    promptLoader,
    loadPrompt,
    loadQCIPrompt,
    loadOptimizationPrompt
};