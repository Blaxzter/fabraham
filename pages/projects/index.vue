<template>
    <div class="container mx-auto px-4 py-16 max-w-7xl">
        <!-- Header Section with GSAP fade-in opportunity -->
        <div class="text-center mb-16 timeline-header">
            <h1 class="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
                My Computer Science Projects
            </h1>
            <p class="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                A timeline of my journey through various computer science projects, from web
                development to machine learning and blockchain technologies.
            </p>
        </div>

        {{ error }}

        <!-- Loading State -->
        <div v-if="pending" class="text-center py-12">
            <Loader2 class="w-8 h-8 animate-spin mx-auto mb-4" />
            <p class="text-gray-600 dark:text-gray-400">Loading projects...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="text-center py-12">
            <AlertTriangle class="w-8 h-8 text-red-500 mx-auto mb-4" />
            <p class="text-red-600 dark:text-red-400">
                Failed to load projects. Please try again later.
            </p>
        </div>

        <!-- Timeline Content -->
        <template v-else>
            <!-- Timeline Container -->
            <div class="relative timeline-container">
                <!-- Enhanced Timeline Line with gradient -->
                <div
                    class="timeline-line absolute left-12 md:left-1/2 top-0 bottom-0 w-1 md:w-1.5 transform md:-translate-x-1/2"
                >
                    <!-- Gradient background -->
                    <div
                        class="absolute inset-0 bg-gradient-to-b from-transparent via-primary-500/50 to-transparent"
                    />
                    <!-- Solid line -->
                    <div class="absolute inset-0 bg-primary-200 dark:bg-primary-900/50" />
                    <!-- Animated progress line (GSAP scroll trigger opportunity) -->
                    <div
                        class="timeline-progress absolute inset-x-0 top-0 bg-gradient-to-b from-primary-500 to-primary-600"
                        style="height: 0%"
                    />
                </div>

                <!-- Timeline Items -->
                <div class="space-y-12 md:space-y-20">
                    <div
                        v-for="(project, index) in projects || []"
                        :key="project.path"
                        class="timeline-item relative"
                        :data-index="index"
                    >
                        <!-- Timeline Row -->
                        <div class="flex items-center">
                            <!-- Desktop: Date Label (Left Side) -->
                            <div
                                class="timeline-date hidden md:flex w-5/12 justify-end pr-12"
                                :class="index % 2 === 0 ? 'md:flex' : 'md:hidden'"
                            >
                                <time
                                    class="text-lg font-semibold text-gray-600 dark:text-gray-400 tracking-wide"
                                >
                                    {{ formatDate(project.date) }}
                                </time>
                            </div>

                            <!-- Timeline Node with enhanced design -->
                            <div
                                class="timeline-node absolute left-12 md:left-1/2 transform -translate-x-1/2 z-20"
                            >
                                <!-- Outer ring for hover effect -->
                                <div
                                    class="node-ring absolute inset-0 w-12 h-12 -m-4 rounded-full border-2 border-primary-500/20 scale-0 transition-transform duration-500"
                                />
                                <!-- Pulsing effect for featured projects -->
                                <div
                                    v-if="project.featured"
                                    class="absolute inset-0 w-8 h-8 -m-2 bg-primary-500/30 rounded-full animate-ping"
                                />
                                <!-- Main node -->
                                <div
                                    class="node-core relative w-4 h-4 bg-white dark:bg-gray-900 border-3 border-primary-500 rounded-full shadow-lg transition-all duration-300 hover:scale-125"
                                >
                                    <!-- Inner dot -->
                                    <div class="absolute inset-1 bg-primary-500 rounded-full" />
                                </div>
                            </div>

                            <!-- Content Card with enhanced styling -->
                            <div
                                class="timeline-card w-full md:w-5/12 ml-24 md:ml-0"
                                :class="index % 2 === 0 ? 'md:ml-12' : 'md:mr-12 md:ml-auto'"
                            >
                                <!-- Mobile Date -->
                                <div class="md:hidden mb-4">
                                    <time
                                        class="text-sm font-semibold text-gray-600 dark:text-gray-400 tracking-wide"
                                    >
                                        {{ formatDate(project.date) }}
                                    </time>
                                </div>

                                <!-- Enhanced Card -->
                                <div class="card-wrapper group relative">
                                    <!-- Card glow effect on hover -->
                                    <div
                                        class="absolute -inset-0.5 bg-gradient-to-r from-primary-500/20 to-purple-500/20 rounded-2xl opacity-0 group-hover:opacity-100 blur transition-all duration-500"
                                    />

                                    <!-- Main card -->
                                    <div
                                        class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg group-hover:shadow-2xl transition-all duration-500 overflow-hidden"
                                    >
                                        <!-- Decorative gradient bar -->
                                        <div
                                            class="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary-500 to-purple-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"
                                        />

                                        <!-- Project Image with parallax opportunity -->
                                        <div
                                            v-if="project.image"
                                            class="relative overflow-hidden aspect-video"
                                        >
                                            <div class="image-wrapper absolute inset-0">
                                                <NuxtImg
                                                    :src="project.image"
                                                    :alt="project.title"
                                                    class="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                                                    loading="lazy"
                                                    @error="handleImageError"
                                                />
                                            </div>
                                            <!-- Image overlay gradient -->
                                            <div
                                                class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                            />
                                        </div>

                                        <!-- Card Content -->
                                        <div class="p-6 md:p-8">
                                            <!-- Badges with stagger animation opportunity -->
                                            <div class="flex flex-wrap gap-2 mb-4">
                                                <Badge
                                                    v-if="project.featured"
                                                    variant="default"
                                                    class="badge-item transform transition-all duration-300"
                                                >
                                                    <Star class="w-3 h-3 mr-1" />
                                                    Featured
                                                </Badge>
                                                <Badge
                                                    :variant="
                                                        getStatusVariant(project.status) as any
                                                    "
                                                    class="badge-item transform transition-all duration-300"
                                                >
                                                    {{ project.status }}
                                                </Badge>
                                            </div>

                                            <!-- Title with text reveal animation opportunity -->
                                            <h3
                                                class="project-title text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3 leading-tight"
                                            >
                                                {{ project.title }}
                                            </h3>

                                            <!-- Description -->
                                            <p
                                                class="project-description text-gray-600 dark:text-gray-300 mb-6 leading-relaxed"
                                            >
                                                {{ project.description }}
                                            </p>

                                            <!-- Technologies with stagger animation -->
                                            <div class="flex flex-wrap gap-2 mb-6">
                                                <Badge
                                                    v-for="(
                                                        tech, techIndex
                                                    ) in project.technologies"
                                                    :key="tech"
                                                    variant="secondary"
                                                    class="tech-badge text-xs transform transition-all duration-300"
                                                    :style="`--tech-index: ${techIndex}`"
                                                >
                                                    {{ tech }}
                                                </Badge>
                                            </div>

                                            <!-- Action Buttons with hover effects -->
                                            <div class="flex flex-wrap gap-3">
                                                <Button
                                                    variant="default"
                                                    size="sm"
                                                    as-child
                                                    class="action-button group/btn"
                                                >
                                                    <NuxtLink :to="project.path">
                                                        <Eye
                                                            class="w-4 h-4 mr-2 group-hover/btn:rotate-12 transition-transform duration-300"
                                                        />
                                                        View Details
                                                    </NuxtLink>
                                                </Button>

                                                <Button
                                                    v-if="project.github"
                                                    variant="outline"
                                                    size="sm"
                                                    as-child
                                                    class="action-button group/btn"
                                                >
                                                    <a
                                                        :href="project.github"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        <Github
                                                            class="w-4 h-4 mr-2 group-hover/btn:rotate-12 transition-transform duration-300"
                                                        />
                                                        GitHub
                                                    </a>
                                                </Button>

                                                <Button
                                                    v-if="project.demo"
                                                    variant="outline"
                                                    size="sm"
                                                    as-child
                                                    class="action-button group/btn"
                                                >
                                                    <a
                                                        :href="project.demo"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        <Globe
                                                            class="w-4 h-4 mr-2 group-hover/btn:rotate-12 transition-transform duration-300"
                                                        />
                                                        Demo
                                                    </a>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Desktop: Date Label (Right Side) -->
                            <div
                                class="timeline-date hidden md:flex w-5/12 justify-start pl-12"
                                :class="index % 2 !== 0 ? 'md:flex' : 'md:hidden'"
                            >
                                <time
                                    class="text-lg font-semibold text-gray-600 dark:text-gray-400 tracking-wide"
                                >
                                    {{ formatDate(project.date) }}
                                </time>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- View Toggle with smooth transition -->
            <div class="mt-20 text-center">
                <Button
                    variant="outline"
                    size="lg"
                    class="view-toggle-btn group"
                    @click="toggleView"
                >
                    <LayoutGrid
                        v-if="viewMode === 'timeline'"
                        class="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-500"
                    />
                    <Clock
                        v-else
                        class="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-500"
                    />
                    {{
                        viewMode === 'timeline' ? 'Switch to Grid View' : 'Switch to Timeline View'
                    }}
                </Button>
            </div>

            <!-- Grid View remains the same but with animation classes -->
            <Transition name="view-transition">
                <div
                    v-if="viewMode === 'grid'"
                    class="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                    <!-- Grid cards with stagger animation opportunity -->
                    <Card
                        v-for="(project, index) in projects || []"
                        :key="project.path"
                        class="grid-card hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2"
                        :style="`--card-index: ${index}`"
                    >
                        <!-- Existing card content... -->
                    </Card>
                </div>
            </Transition>
        </template>
    </div>
</template>

<script setup lang="ts">
import {
    Loader2,
    AlertTriangle,
    Eye,
    Github,
    Globe,
    LayoutGrid,
    Clock,
    Star,
} from 'lucide-vue-next';
import { onMounted, onBeforeUnmount } from 'vue';

// Meta data
useSeoMeta({
    title: 'Projects | CS Portfolio',
    description:
        'Explore my computer science projects including web development, machine learning, and blockchain applications.',
    ogTitle: 'Projects | CS Portfolio',
    ogDescription:
        'Explore my computer science projects including web development, machine learning, and blockchain applications.',
    ogType: 'website',
});

// Data
const viewMode = ref('timeline');

const {
    data: projects,
    pending,
    error,
} = await useAsyncData('projects', async () => {
    try {
        const result = await queryCollection('projects').all();
        console.log('Projects loaded:', result);
        return result;
    } catch (e) {
        console.error('Error loading projects:', e);
        throw e;
    }
});

const { gsap, ScrollTrigger } = useGsap();

// GSAP Animation Setup
onMounted(() => {
    if (!gsap) return;

    // Store references for cleanup
    const ctx = gsap.context(() => {
        // 1. Header fade-in animation
        gsap.from('.timeline-header', {
            opacity: 0,
            y: 50,
            duration: 1,
            ease: 'power3.out',
        });

        // 2. Timeline progress line animation with ScrollTrigger
        if (ScrollTrigger) {
            gsap.to('.timeline-progress', {
                height: '100%',
                ease: 'none',
                scrollTrigger: {
                    trigger: '.timeline-container',
                    start: 'top center',
                    end: 'bottom center',
                    scrub: 1,
                },
            });
        }

        // 3. Timeline items stagger animation
        const timelineItems = gsap.utils.toArray('.timeline-item') as Element[];
        timelineItems.forEach((item, index) => {
            gsap.from(item, {
                opacity: 0,
                x: index % 2 === 0 ? -100 : 100,
                duration: 0.8,
                scrollTrigger: ScrollTrigger
                    ? {
                          trigger: item,
                          start: 'top 85%',
                          toggleActions: 'play none none none',
                      }
                    : undefined,
            });
        });

        // 4. Node animations on scroll
        const timelineNodes = gsap.utils.toArray('.timeline-node') as Element[];
        timelineNodes.forEach((node) => {
            gsap.from(node, {
                scale: 0,
                duration: 0.5,
                ease: 'back.out(1.7)',
                scrollTrigger: ScrollTrigger
                    ? {
                          trigger: node,
                          start: 'top 80%',
                          toggleActions: 'play none none none',
                      }
                    : undefined,
            });
        });

        // 5. Card parallax effect
        const imageWrappers = gsap.utils.toArray('.image-wrapper') as Element[];
        imageWrappers.forEach((image) => {
            gsap.to(image, {
                yPercent: -20,
                ease: 'none',
                scrollTrigger: ScrollTrigger
                    ? {
                          trigger: image,
                          start: 'top bottom',
                          end: 'bottom top',
                          scrub: true,
                      }
                    : undefined,
            });
        });

        // 6. Text reveal animations
        const projectTitles = gsap.utils.toArray('.project-title') as HTMLElement[];
        projectTitles.forEach((title) => {
            // Create a simple word-by-word reveal
            const text = title.textContent || '';
            const words = text.split(' ');

            // Wrap each word in a span
            title.innerHTML = words
                .map((word) => `<span class="inline-block">${word}</span>`)
                .join(' ');

            // Animate the words
            gsap.from(title.querySelectorAll('span'), {
                opacity: 0,
                y: 20,
                duration: 0.6,
                stagger: 0.05,
                scrollTrigger: ScrollTrigger
                    ? {
                          trigger: title,
                          start: 'top 85%',
                          toggleActions: 'play none none none',
                      }
                    : undefined,
            });
        });

        // 7. Badge stagger animations
        const timelineCards = gsap.utils.toArray('.timeline-card') as HTMLElement[];
        timelineCards.forEach((card) => {
            const badges = card.querySelectorAll('.tech-badge');

            gsap.from(badges, {
                opacity: 0,
                scale: 0.8,
                duration: 0.4,
                stagger: 0.05,
                scrollTrigger: ScrollTrigger
                    ? {
                          trigger: card,
                          start: 'top 80%',
                          toggleActions: 'play none none none',
                      }
                    : undefined,
            });
        });

        // 8. Hover animations for buttons
        const actionButtons = gsap.utils.toArray('.action-button') as HTMLElement[];
        actionButtons.forEach((button) => {
            button.addEventListener('mouseenter', () => {
                gsap.to(button, {
                    scale: 1.05,
                    duration: 0.3,
                    ease: 'power2.out',
                });
            });

            button.addEventListener('mouseleave', () => {
                gsap.to(button, {
                    scale: 1,
                    duration: 0.3,
                    ease: 'power2.out',
                });
            });
        });

        // 9. Timeline date fade-ins
        const timelineDates = gsap.utils.toArray('.timeline-date') as HTMLElement[];
        timelineDates.forEach((date) => {
            gsap.from(date, {
                opacity: 0,
                x: date.classList.contains('text-right') ? 50 : -50,
                duration: 0.6,
                scrollTrigger: ScrollTrigger
                    ? {
                          trigger: date,
                          start: 'top 85%',
                          toggleActions: 'play none none none',
                      }
                    : undefined,
            });
        });
    }); // End of GSAP context

    // Cleanup
    onBeforeUnmount(() => {
        ctx.revert(); // Clean up all GSAP animations
    });
});

// Methods
const formatDate = (dateString: string): string => {
    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    };
    return new Date(dateString).toLocaleDateString('en-US', options);
};

const getStatusVariant = (status: string): string => {
    const statusVariants: Record<string, string> = {
        completed: 'default',
        'in-progress': 'warning',
        planning: 'info',
        archived: 'secondary',
    };
    return statusVariants[status] || 'secondary';
};

const toggleView = () => {
    viewMode.value = viewMode.value === 'timeline' ? 'grid' : 'timeline';
};

const handleImageError = (event: string | Event) => {
    if (typeof event === 'string') return;
    const target = event.target as HTMLImageElement;
    // Use percent-encoded SVG to avoid atob issues
    target.src =
        "data:image/svg+xml,%3Csvg width='300' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' fill='%23ddd'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial,sans-serif' font-size='14' fill='%23999' text-anchor='middle' dy='.3em'%3EImage Not Found%3C/text%3E%3C/svg%3E";
    target.classList.add('opacity-50');
};
</script>

<style scoped>
/* Initial states for animations to prevent flash */
.timeline-header {
    opacity: 0;
    transform: translateY(50px);
}

.timeline-item {
    opacity: 0;
}

.timeline-node {
    transform: scale(0);
}

.timeline-date {
    opacity: 0;
}

.project-title span {
    opacity: 0;
    transform: translateY(20px);
}

.tech-badge {
    opacity: 0;
    transform: scale(0.8);
}

/* CSS fallback animations for when GSAP hasn't loaded yet */
@media (prefers-reduced-motion: no-preference) {
    .timeline-header {
        animation: fadeInUp 1s ease-out forwards;
        animation-delay: 0.1s;
    }

    .timeline-item {
        animation: fadeInSide 0.8s ease-out forwards;
        animation-delay: calc(var(--index, 0) * 0.1s + 0.3s);
    }

    .timeline-node {
        animation: scaleIn 0.5s ease-out forwards;
        animation-delay: calc(var(--index, 0) * 0.1s + 0.5s);
    }
}

/* View transition */
.view-transition-enter-active,
.view-transition-leave-active {
    transition: all 0.5s ease;
}

.view-transition-enter-from {
    opacity: 0;
    transform: translateY(20px);
}

.view-transition-leave-to {
    opacity: 0;
    transform: translateY(-20px);
}

/* Enhanced responsive design */
@media (max-width: 768px) {
    .timeline-line {
        left: 3rem !important;
    }

    .timeline-node {
        left: 3rem !important;
    }

    .timeline-card {
        margin-left: 6rem !important;
        width: calc(100% - 6rem) !important;
    }
}

/* Smooth hover transitions */
.node-core:hover .node-ring {
    transform: scale(1);
}

/* CSS animation keyframes */
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(50px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes fadeInSide {
    from {
        opacity: 0;
        transform: translateX(-100px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

@keyframes scaleIn {
    from {
        opacity: 0;
        transform: scale(0);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}

/* Grid card stagger delays for CSS fallback */
.grid-card {
    animation: fadeInUp 0.6s ease forwards;
    animation-delay: calc(var(--card-index) * 0.1s);
}

/* Tech badge stagger delays */
.tech-badge {
    animation: scaleInBadge 0.4s ease forwards;
    animation-delay: calc(var(--tech-index) * 0.05s + 0.8s);
}

@keyframes scaleInBadge {
    from {
        opacity: 0;
        transform: scale(0.8);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}

/* Print styles */
@media print {
    .timeline-line,
    .view-toggle-btn,
    .action-button {
        display: none !important;
    }

    .timeline-card {
        width: 100% !important;
        margin: 0 !important;
        page-break-inside: avoid;
    }

    /* Show all content immediately in print */
    .timeline-header,
    .timeline-item,
    .timeline-node,
    .timeline-date,
    .project-title span,
    .tech-badge {
        opacity: 1 !important;
        transform: none !important;
        animation: none !important;
    }
}
</style>
