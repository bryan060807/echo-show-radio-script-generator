export interface SampleTemplate {
  id: string;
  title: string;
  category: 'History' | 'Business' | 'Social Trends';
  content: string;
}

export const SAMPLE_TEMPLATES: SampleTemplate[] = [
  {
    id: 'lunar-landing',
    title: 'Project Apollo Lunar Mission Report (Excerpt)',
    category: 'History',
    content: `NASA Apollo 11 Technical Summary & Mission Log
Date: July 20, 1969
Spacecraft: Lunar Module "Eagle", Service Module "Columbia"
Astronauts: Neil A. Armstrong, Edwin E. "Buzz" Aldrin Jr., Michael Collins

Mission Phase: Lunar Landing
During the final descent phase of the descent engine firing, a series of computer alarms occurred (Program Alarm 1201 and 1202). These alarms indicated that the computer was overloaded with radar data, though it continued to execute vital steering and thrust control. 

Fuel reserves were critical. Due to an unexpected drift past the designated landing area, Armstrong was forced to fly the spacecraft manually over a boulder-strewn crater field to find a safe zone. Eagle landed with approximately 25 seconds of descent fuel remaining.

Communication Log Accents:
Armstrong: "Houston, Tranquility Base here. The Eagle has landed."
CAPCOM Charlie Duke: "Roger, Twanq... Tranquility, we copy you on the ground. You got a bunch of guys about to turn blue. We're breathing again. Thanks a lot."

Key Scientific Outcomes:
1. Retrieval of 47.5 pounds of lunar material (moon rocks and soil).
2. Deployment of the Passive Seismic Experiment Package to detect moonquakes.
3. Laser Ranging Retro-Reflector experiment, allowing pinpoint measurements of Earth-Moon distance.
4. Solar Wind Composition experiment with aluminum foil exposure.`
  },
  {
    id: 'coffee-ritual',
    title: 'The Modern Coffee Culture & Economic Paradox',
    category: 'Social Trends',
    content: `Title: Espresso, Society, and the Paradox of the Morning Cup
By: Dr. Elena Vance, Behavioral Sociologist

We live in an age where coffee is no longer simple agricultural produce; it is a complex social currency. The daily ritual of queueing at boutique cafes is driven by psychological needs for identity and micro-productivity rather than chemical caffeine dependency alone.

The Economic Paradox:
While a physical cup of artisanal pour-over coffee easily commands $6.50 to $8.00 in major cities, the coffee farmers growing the beans in regions like Chiapas or Sidama often receive less than $0.15 per pound of raw green beans. This 50x markup is absorbed by roasting logistics, premium retail real estate, marketing, and cup packaging. 

Contrasting Viewpoints:
- Corporate Caffeine Advocates: Argue that specialty coffee chains stimulate local urban economies, offer thousands of starting jobs, and create communal third-spaces essential for remote freelancers.
- Fair Trade Activists: Highlight the neo-colonial patterns of supply chains, environmental degradation from sun-tolerant monoculture farms, and the systemic underpayment of Indigenous growers.`
  },
  {
    id: 'ai-workplace',
    title: 'Executive Briefing: AI Integration & Employee Sentiment',
    category: 'Business',
    content: `Executive Summary: Artificial Intelligence in White Collar Environments
Commissioned by: Apex Management Consultants, Q3 2025

The rapid deployment of generative AI virtual agents across customer support, marketing copywriting, and legal document review has sparked a deep division in workplace psychology.

Core Statistics:
- 68% of knowledge workers report using AI tools daily to speed up draft composition and basic editing.
- 42% admit keeping their AI use secret from direct supervisors due to fears of appearing redundant.
- 54% of middle managers believe AI tools will lead to head-count reductions of up to 20% in their departments within 24 months.

The Operational Tug-of-War:
Executives view the integration as a clean efficiency victory, boasting up to 35% shorter turnaround times. However, front-line staff report heightened cognitive fatigue and are expressing "imposter anxiety"—the feeling that their actual creative expertise is being sterilized into prompting a machine. There is a critical, unspoken tension between organizational hyper-scale and human worker value.`
  }
];
