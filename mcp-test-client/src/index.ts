#!/usr/bin/env node

import { GenericOrchestrator } from './generic-orchestrator.js';
import { LLMFactory } from './llm-factory.js';
import { ConfigManager } from './config-manager.js';
import { TestData } from './types.js';
import chalk from 'chalk';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';

function getProviderIcon(provider: string): string {
  const icons = {
    'lmstudio': '🧠',
    'gemini': '✨',
    'anthropic': '🔮',
    'openai': '💡'
  };
  return icons[provider as keyof typeof icons] || '❓';
}

function isProviderImplemented(provider: string): boolean {
  return ['lmstudio'].includes(provider);
}

async function main() {
  console.log(chalk.blue(`
  ╔══════════════════════════════════════════════════════════╗
  ║                  MCP Test Client                          ║
  ║            Model Context Protocol Demo                    ║
  ║              (Configuration Driven)                       ║
  ╚══════════════════════════════════════════════════════════╝
  `));

  try {
    // Load configuration
    const config = ConfigManager.load();
    console.log(chalk.green(`✅ Configuration loaded successfully`));

    // Show available LLM providers
    const availableProviders = ConfigManager.getAvailableLLMProviders();
    const providerChoices = Object.entries(availableProviders).map(([key, provider]) => ({
      name: `${getProviderIcon(key)} ${provider.description}`,
      value: key,
      disabled: !isProviderImplemented(key)
    }));

    // Ask user to choose LLM provider (or use config default)
    const { shouldOverride } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldOverride',
        message: `Use configured LLM provider '${config.llm.provider}'?`,
        default: true
      }
    ]);

    let selectedProvider = config.llm.provider;
    if (!shouldOverride) {
      const { llmProvider } = await inquirer.prompt([
        {
          type: 'list',
          name: 'llmProvider',
          message: 'Which LLM provider would you like to use?',
          choices: providerChoices
        }
      ]);
      selectedProvider = llmProvider;
      ConfigManager.setLLMProvider(selectedProvider);
    }

    console.log(chalk.gray(`✨ Using ${selectedProvider} LLM provider with configuration-driven setup!`));

    // Create LLM using factory
    const llmConfig = ConfigManager.getLLMConfig();
    const llm = LLMFactory.create(llmConfig);

    // Show provider-specific warnings
    if (selectedProvider === 'lmstudio') {
      console.log(chalk.yellow(`\n⚠️  Make sure LM Studio is running on ${llmConfig.config.baseUrl || 'http://localhost:1234'}`));
      console.log(chalk.gray(`   You can change the URL in config/mcp-test-config.json if needed`));
    }

    // Create orchestrator with configuration
    const orchestratorConfig = ConfigManager.getOrchestratorConfig();
    const orchestrator = new GenericOrchestrator(llm, orchestratorConfig);

    console.log(chalk.blue(`\n🚀 Initializing MCP Test Client...`));
    
    // Set up MCP server connection from configuration
    const serverConfig = ConfigManager.getMCPServerConfig('banking');
    await orchestrator.addMCPServer('banking', serverConfig);
    
    console.log(chalk.green(`✅ MCP Test Client initialized with ${selectedProvider} LLM provider!`));

    // Load test data for scenario options
    const testDataPath = path.join(process.cwd(), 'test-data', 'prompts.json');
    const testData: TestData = JSON.parse(fs.readFileSync(testDataPath, 'utf8'));

    // Interactive CLI
    let exit = false;
    while (!exit) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '🎬 Try a scenario prompt (Real LLM)', value: 'run_scenario' },
            { name: '🚪 Exit', value: 'exit' }
          ]
        }
      ]);

      switch (action) {
        case 'run_scenario':
          await runScenarioWithRealLLM(orchestrator, testData);
          break;
        
        case 'exit':
          exit = true;
          console.log(chalk.blue(`👋 Goodbye!`));
          break;
      }
    }

  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${(error as Error).message}`));
    process.exit(1);
  }
}

async function runScenarioWithRealLLM(orchestrator: GenericOrchestrator, testData: TestData) {
  const { scenario } = await inquirer.prompt([
    {
      type: 'list',
      name: 'scenario',
      message: 'Which scenario prompt would you like to try?',
      choices: testData.scenarios.map(s => ({
        name: `${s.name} - ${s.description}`,
        value: s.userPrompt
      }))
    }
  ]);

  console.log(chalk.cyan(`\n🤖 Sending prompt to Real LLM...`));
  console.log(chalk.gray(`📝 Prompt: "${scenario}"`));
  
  const result = await orchestrator.handleUserPrompt(scenario);
  
  console.log(chalk.blue(`\n📊 Results:`));
  console.log(chalk.gray(`   ${result.success ? '✅' : '❌'} Success: ${result.success}`));
  console.log(chalk.gray(`   🔄 Rounds: ${result.rounds}`));
  
  if (result.response) {
    console.log(chalk.green(`\n💬 Final Response:`));
    console.log(chalk.white(result.response));
  }
}



// Run the main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(chalk.red(`Fatal error: ${error.message}`));
    process.exit(1);
  });
} 