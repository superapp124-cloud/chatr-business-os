/**
 * CHATR Universal Intent OS hooks
 *
 * These hooks keep React Query as the UI cache, while the OSGateway owns the
 * runtime contract. Studio2 gets instant local realtime updates through the
 * gateway subscription and optional Supabase events when configured.
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  OSGateway,
  IntentAnalysis,
  OSEnvelope,
  SearchResult,
  CapabilityStatus,
  ImportJob
} from '@/core/os/gateway/OSGateway';

const DEFAULT_WORKSPACE = 'TalentXcel Services';

function unwrap<T>(res: OSEnvelope<T>): T {
  if (!res.success) {
    throw new Error(res.errors[0]?.message || 'OS Gateway request failed');
  }
  return res.data as T;
}

function useRuntimeInvalidation(workspaceId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    return OSGateway.subscribe(workspaceId, () => {
      queryClient.invalidateQueries({ queryKey: ['homeMetrics', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['recentIntents', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['recentActivity', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['businessInsights', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['activeExecutions', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['activeImports', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['capabilitiesHealth', workspaceId] });
    });
  }, [queryClient, workspaceId]);
}

export function useHome(workspaceId: string = DEFAULT_WORKSPACE) {
  useRuntimeInvalidation(workspaceId);

  const {
    data: metrics,
    isLoading: metricsLoading,
    error: metricsError,
    refetch: refreshMetrics
  } = useQuery({
    queryKey: ['homeMetrics', workspaceId],
    queryFn: async () => unwrap(await OSGateway.Home.getDashboardMetrics(workspaceId)),
    staleTime: 1000,
    retry: 2
  });

  const {
    data: recentIntents,
    isLoading: intentsLoading,
    error: intentsError,
    refetch: refreshIntents
  } = useQuery({
    queryKey: ['recentIntents', workspaceId],
    queryFn: async () => unwrap(await OSGateway.Home.getRecentIntents(workspaceId)),
    staleTime: 1000,
    retry: 2
  });

  const {
    data: recentActivity,
    isLoading: activityLoading,
    error: activityError,
    refetch: refreshActivity
  } = useQuery({
    queryKey: ['recentActivity', workspaceId],
    queryFn: async () => unwrap(await OSGateway.Home.getRecentActivity(workspaceId)),
    staleTime: 1000,
    retry: 2
  });

  const {
    data: insights,
    isLoading: insightsLoading,
    error: insightsError,
    refetch: refreshInsights
  } = useQuery({
    queryKey: ['businessInsights', workspaceId],
    queryFn: async () => unwrap(await OSGateway.Home.getInsights(workspaceId)),
    staleTime: 1000,
    retry: 2
  });

  const refresh = () => {
    refreshMetrics();
    refreshIntents();
    refreshActivity();
    refreshInsights();
  };

  return {
    metrics,
    recentIntents: recentIntents || [],
    recentActivity: recentActivity || [],
    insights: insights || [],
    loading: metricsLoading || intentsLoading || activityLoading || insightsLoading,
    error: metricsError || intentsError || activityError || insightsError,
    refresh
  };
}

export function useWatch(workspaceId: string = DEFAULT_WORKSPACE) {
  useRuntimeInvalidation(workspaceId);

  const {
    data: activeExecutions,
    isLoading: loading,
    error,
    refetch: refresh
  } = useQuery({
    queryKey: ['activeExecutions', workspaceId],
    queryFn: async () => unwrap(await OSGateway.Watch.getActiveExecutions(workspaceId)),
    refetchInterval: 1000,
    retry: 3
  });

  return {
    activeExecutions: activeExecutions || [],
    loading,
    error,
    refresh
  };
}

export function useDiscover(workspaceId: string = DEFAULT_WORKSPACE) {
  const { mutateAsync: search, data: results, isPending: loading, error, reset } = useMutation({
    mutationFn: async (query: string): Promise<SearchResult[]> => {
      if (!query.trim()) return [];
      return unwrap(await OSGateway.Discover.search(workspaceId, query));
    }
  });

  return { search, results: results || [], loading, error, reset };
}

export function useManage(workspaceId: string = DEFAULT_WORKSPACE) {
  useRuntimeInvalidation(workspaceId);
  const queryClient = useQueryClient();

  const {
    data: capabilities,
    isLoading: loading,
    error,
    refetch: refresh
  } = useQuery({
    queryKey: ['capabilitiesHealth', workspaceId],
    queryFn: async () => unwrap(await OSGateway.Manage.getCapabilitiesHealth(workspaceId)),
    staleTime: 1000,
    retry: 2
  });

  const testMutation = useMutation({
    mutationFn: async (capabilityId: string): Promise<CapabilityStatus | undefined> =>
      unwrap(await OSGateway.Manage.testCapability(workspaceId, capabilityId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capabilitiesHealth', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['recentActivity', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['homeMetrics', workspaceId] });
    }
  });

  const configureMutation = useMutation({
    mutationFn: async (capabilityId: string): Promise<CapabilityStatus | undefined> =>
      unwrap(await OSGateway.Manage.configureCapability(workspaceId, capabilityId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capabilitiesHealth', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['recentActivity', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['homeMetrics', workspaceId] });
    }
  });

  return {
    capabilities: capabilities || [],
    loading,
    error,
    refresh,
    testCapability: testMutation.mutateAsync,
    configureCapability: configureMutation.mutateAsync,
    isTestingCapability: testMutation.isPending,
    isConfiguringCapability: configureMutation.isPending
  };
}

export function useImport(workspaceId: string = DEFAULT_WORKSPACE) {
  useRuntimeInvalidation(workspaceId);
  const queryClient = useQueryClient();

  const {
    data: activeImports,
    isLoading: loading,
    error,
    refetch: refresh
  } = useQuery({
    queryKey: ['activeImports', workspaceId],
    queryFn: async (): Promise<ImportJob[]> => unwrap(await OSGateway.Import.getActiveImports(workspaceId)),
    refetchInterval: 1000,
    retry: 2
  });

  const startMutation = useMutation({
    mutationFn: async ({ source, totalItems }: { source: string; totalItems?: number }) =>
      unwrap(await OSGateway.Import.startImport(workspaceId, source, totalItems)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeImports', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['recentActivity', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['homeMetrics', workspaceId] });
    }
  });

  return {
    activeImports: activeImports || [],
    loading,
    error,
    refresh,
    startImport: startMutation.mutateAsync,
    isStartingImport: startMutation.isPending
  };
}

export function useIntent(workspaceId: string = DEFAULT_WORKSPACE) {
  useRuntimeInvalidation(workspaceId);
  const queryClient = useQueryClient();

  const analyzeMutation = useMutation({
    mutationFn: async (prompt: string) => unwrap(await OSGateway.Intent.analyzeIntent(workspaceId, prompt))
  });

  const submitMutation = useMutation({
    mutationFn: async ({ prompt, context }: { prompt: string; context?: any }) =>
      unwrap(await OSGateway.Intent.submitIntent(workspaceId, prompt, context)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeExecutions', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['recentIntents', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['recentActivity', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['businessInsights', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['homeMetrics', workspaceId] });
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (intentId: string) =>
      unwrap(await OSGateway.Intent.approveIntent(workspaceId, intentId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeExecutions', workspaceId] });
    }
  });

  return {
    analyze: analyzeMutation.mutateAsync,
    submit: submitMutation.mutateAsync,
    approve: approveMutation.mutateAsync,
    analysis: analyzeMutation.data as IntentAnalysis | undefined,
    isAnalyzing: analyzeMutation.isPending,
    isSubmitting: submitMutation.isPending,
    isApproving: approveMutation.isPending,
    reset: () => {
      analyzeMutation.reset();
      submitMutation.reset();
      approveMutation.reset();
    }
  };
}
