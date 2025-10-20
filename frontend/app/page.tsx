import Link from 'next/link'

interface Module {
  id: string
  name: string
  description: string
  href: string
  status: 'ready' | 'dev' | 'planned'
  color: string
  stats?: string
}

const modules: Module[] = [
  {
    id: 'prompt-optimization',
    name: 'Prompt Optimization',
    description: 'AI-powered prompt optimization with Supabase sync - сегодняшний модуль!',
    href: '/prompt-optimization',
    status: 'ready',
    color: 'bg-purple-500 hover:bg-purple-600',
    stats: '11/11 synced'
  },
  {
    id: 'dashboard',
    name: 'Analytics Dashboard',
    description: 'Complete VAPI analytics with real-time metrics and filtering',
    href: '/dashboard',
    status: 'ready',
    color: 'bg-blue-500 hover:bg-blue-600',
    stats: '8,559 calls'
  },
  {
    id: 'execution-logs',
    name: 'Execution Logs',
    description: 'System execution logs with master-detail view',
    href: '/execution-logs',
    status: 'ready',
    color: 'bg-green-500 hover:bg-green-600',
    stats: 'Real-time'
  },
  {
    id: 'supabase-sync',
    name: 'Supabase Integration',
    description: 'Complete data synchronization with Supabase database',
    href: 'https://supabase.com/dashboard/project/hyokiyktrvqgxedfpilr/editor',
    status: 'ready',
    color: 'bg-emerald-500 hover:bg-emerald-600',
    stats: '100% success'
  },
  {
    id: 'n8n-workflows',
    name: 'N8N Automation',
    description: 'Automated workflow processing and real-time notifications',
    href: '/n8n_workflows',
    status: 'dev',
    color: 'bg-orange-500 hover:bg-orange-600'
  },
  {
    id: 'ai-coaching',
    name: 'AI Coaching',
    description: 'Personalized coaching recommendations based on call analysis',
    href: '/ai-coaching',
    status: 'planned',
    color: 'bg-pink-500 hover:bg-pink-600'
  }
]

const statusLabels = {
  ready: 'Ready',
  dev: 'Development',
  planned: 'Planned'
}

const statusColors = {
  ready: 'bg-green-100 text-green-800',
  dev: 'bg-yellow-100 text-yellow-800',
  planned: 'bg-gray-100 text-gray-800'
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Young Caesar VAPI Analytics
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Advanced AI-powered call analysis and optimization platform with real-time Supabase integration
          </p>
        </div>

        {/* Special highlight for today's module */}
        <div className="mb-8 p-4 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl border border-purple-200">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-purple-900 mb-2">
              🎉 Сегодня добавлено: Prompt Optimization + Supabase Sync
            </h2>
            <p className="text-purple-700">
              Полная интеграция оптимизации промптов с базой данных • 100% успех • 11/11 записей
            </p>
          </div>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => (
            <div key={module.id} className="group">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full transition-all duration-300 hover:shadow-lg hover:scale-105">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-lg ${module.color} flex items-center justify-center transition-colors duration-300`}>
                    <div className="w-6 h-6 bg-white rounded"></div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[module.status]}`}>
                      {statusLabels[module.status]}
                    </span>
                    {module.stats && (
                      <span className="text-xs text-gray-500 font-medium">
                        {module.stats}
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {module.name}
                </h3>
                <p className="text-gray-600 text-sm mb-4 flex-grow">
                  {module.description}
                </p>

                {module.status === 'ready' ? (
                  module.href.startsWith('http') ? (
                    <a
                      href={module.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-block w-full text-center px-4 py-2 rounded-lg text-white font-medium transition-colors duration-300 ${module.color}`}
                    >
                      Open Module
                    </a>
                  ) : module.href.startsWith('/production_scripts') || module.href.startsWith('/dashboards') ? (
                    <a
                      href={module.href}
                      className={`inline-block w-full text-center px-4 py-2 rounded-lg text-white font-medium transition-colors duration-300 ${module.color}`}
                    >
                      Open Dashboard
                    </a>
                  ) : (
                    <Link
                      href={module.href}
                      className={`inline-block w-full text-center px-4 py-2 rounded-lg text-white font-medium transition-colors duration-300 ${module.color}`}
                    >
                      Open Module
                    </Link>
                  )
                ) : (
                  <button
                    disabled
                    className="w-full px-4 py-2 rounded-lg bg-gray-300 text-gray-500 font-medium cursor-not-allowed"
                  >
                    {module.status === 'dev' ? 'In Development' : 'Coming Soon'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-blue-600 mb-2">2,612</div>
            <div className="text-gray-600">Total Calls</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-green-600 mb-2">11</div>
            <div className="text-gray-600">AI Assistants</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-purple-600 mb-2">100%</div>
            <div className="text-gray-600">Sync Success</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-2xl font-bold text-orange-600 mb-2">v2.1.0</div>
            <div className="text-gray-600">Current Version</div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-gray-500 text-sm">
          <p>Young Caesar VAPI Analytics Platform - Built with Next.js & AI</p>
        </div>
      </div>
    </div>
  )
}
