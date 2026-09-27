import React from 'react';
import { RotateCcw } from 'lucide-react';
import type { Lang } from '../../analytics';
import { GhostButton } from '../seller/ui';

/** Keeps one broken view from taking down the whole workspace. */
export class ViewErrorBoundary extends React.Component<{ lang: Lang; children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    const vi = this.props.lang === 'vi';
    return (
      <div className="bg-surface border border-line shadow-card rounded-2xl p-6 text-center" role="alert">
        <p className="text-sm font-bold text-fg">{vi ? 'Có lỗi khi hiển thị trang này.' : 'Something went wrong rendering this page.'}</p>
        <p className="text-xs text-muted mt-1 break-words">{this.state.error.message}</p>
        <GhostButton className="mt-3" onClick={() => this.setState({ error: null })}>
          <RotateCcw className="w-4 h-4" /> {vi ? 'Thử lại' : 'Retry'}
        </GhostButton>
      </div>
    );
  }
}
