import { Container } from '../../layout';
import { useLanguage } from '../../../context/LanguageContext';

interface TeamMember {
  name: string;
  role: string;
  skills: string[];
  linkedin: string;
}

const teamMembers: TeamMember[] = [
  {
    name: 'Reza Zeraat',
    role: 'coFounder',
    skills: [
      'React', 'Vue', 'Angular', 'Next.js',
      'Node.js', 'Django', 'Spring', 'FastAPI',
      'Python', 'TypeScript', 'Java', 'C++',
      'TensorFlow', 'Pandas', 'Machine Learning'
    ],
    linkedin: 'https://www.linkedin.com/in/reza-zeraat-6628781b3/',
  },
];

export function AboutUs() {
  const { t, isRTL } = useLanguage();

  return (
    <div className="py-8 sm:py-12">
      <Container>
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl shadow-xl shadow-indigo-500/30 overflow-hidden">
            <img src="/logo.svg" alt="CoFinance Logo" className="w-full h-full" loading="eager" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-white mb-4">
            {t('aboutUs')}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            {t('aboutUsDescription')}
          </p>
        </div>

        {/* Mission Section */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-8 sm:p-12 mb-12 text-white">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">{t('ourMission')}</h2>
            <p className="text-lg opacity-90">
              {t('missionDescription')}
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
            <div className="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">{t('featureFast')}</h3>
            <p className="text-slate-600 dark:text-slate-400">
              {t('featureFastDesc')}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">{t('featureAccurate')}</h3>
            <p className="text-slate-600 dark:text-slate-400">
              {t('featureAccurateDesc')}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
            <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">{t('featureGlobal')}</h3>
            <p className="text-slate-600 dark:text-slate-400">
              {t('featureGlobalDesc')}
            </p>
          </div>
        </div>

        {/* Team Section */}
        <div className="mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white text-center mb-8">
            {t('ourTeam')}
          </h2>
          <div className="grid grid-cols-1 gap-8 max-w-2xl mx-auto">
            {teamMembers.map((member) => (
              <div
                key={member.name}
                className="bg-white dark:bg-slate-800/50 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-lg"
              >
                <div className={`flex flex-col sm:flex-row items-center gap-6 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
                  {/* Avatar */}
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg flex-shrink-0">
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </div>

                  {/* Info */}
                  <div className={`flex-1 text-center sm:text-${isRTL ? 'right' : 'left'}`}>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">
                      {member.name}
                    </h3>
                    <p className="text-indigo-600 dark:text-indigo-400 font-medium mb-3">
                      {t(member.role as 'coFounder')}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 mb-4">
                      {t('teamMemberDesc')}
                    </p>

                    {/* Skills */}
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start mb-4">
                      {member.skills.slice(0, 8).map((skill) => (
                        <span
                          key={skill}
                          className="px-2 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>

                    {/* LinkedIn */}
                    <a
                      href={member.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#0077B5] hover:bg-[#006399] text-white rounded-lg transition-colors font-medium"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      {t('viewLinkedIn')}
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tech Stack */}
        <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">{t('builtWith')}</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {['React 18', 'TypeScript', 'Go', 'TailwindCSS', 'TanStack Query', 'Vite'].map((tech) => (
              <span
                key={tech}
                className="px-4 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium shadow-sm border border-slate-200 dark:border-slate-600"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}
