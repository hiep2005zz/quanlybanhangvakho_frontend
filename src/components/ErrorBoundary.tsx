import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Lỗi giao diện bị chặn bởi ErrorBoundary:', error, errorInfo);
  }

  private handleGoHome = () => {
    try {
      sessionStorage.removeItem('clone_order_draft');
    } catch {}
    window.location.href = '/';
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-lg p-6 sm:p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
              ⚠️
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">Đã xảy ra sự cố giao diện</h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Ứng dụng gặp lỗi ngoài dự kiến khi dựng trang này. Bạn có thể tải lại hoặc quay về trang chủ.
              </p>
            </div>
            {this.state.error?.message && (
              <div className="p-3 bg-slate-100 rounded-xl text-left text-xs text-slate-700 font-mono break-words max-h-32 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Tải lại trang
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Về trang chủ
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
