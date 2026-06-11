'use client';

/**
 * Lazy Loading Wrapper
 * Code splitting and lazy loading for better performance
 * Following .cursorrules patterns
 */

import React, { Suspense, ComponentType, LazyExoticComponent } from 'react';
/**
 * Higher-order component for lazy loading
 */
export function withLazyLoading<P extends object>(
  Component: LazyExoticComponent<ComponentType<P>>,
  fallback?: React.ReactNode
) {
  return function LazyComponent(props: P) {
    return (
      <Suspense fallback={fallback || <DefaultLoadingFallback />}>
        <Component {...props} />
      </Suspense>
    );
  };
}

/**
 * Lazy load a component with default loading state
 */
export function lazyLoad<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = React.lazy(importFn);
  return withLazyLoading(LazyComponent, fallback);
}

/**
 * Default loading fallback component
 */
const DefaultLoadingFallback: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-lg text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
};

