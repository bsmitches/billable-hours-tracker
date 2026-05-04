import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Avatar,
  Divider,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';
import { marked } from 'marked';

export interface ActivityItem {
  id: number;
  clientName: string;
  hours: number;
  date: string;
  description: string | null;
  type: 'entry' | 'update' | 'delete';
}

interface ActivityFeedProps {
  items: ActivityItem[];
  title?: string;
  maxItems?: number;
  showTrend?: boolean;
}

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

export function calculateTrend(items: ActivityItem[]): { direction: 'up' | 'down' | 'flat'; percentage: number } {
  if (items.length < 2) return { direction: 'flat', percentage: 0 };

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const thisWeek = items
    .filter(i => new Date(i.date) >= oneWeekAgo)
    .reduce((sum, i) => sum + i.hours, 0);
  const lastWeek = items
    .filter(i => new Date(i.date) >= twoWeeksAgo && new Date(i.date) < oneWeekAgo)
    .reduce((sum, i) => sum + i.hours, 0);

  if (lastWeek === 0) return { direction: thisWeek > 0 ? 'up' : 'flat', percentage: 100 };

  const change = ((thisWeek - lastWeek) / lastWeek) * 100;
  return {
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
    percentage: Math.abs(Math.round(change)),
  };
}

export function renderMarkdownDescription(description: string): string {
  return marked.parse(description) as string;
}

function getTypeColor(type: ActivityItem['type']): 'success' | 'warning' | 'error' {
  switch (type) {
    case 'entry': return 'success';
    case 'update': return 'warning';
    case 'delete': return 'error';
  }
}

function getTypeLabel(type: ActivityItem['type']): string {
  switch (type) {
    case 'entry': return 'New';
    case 'update': return 'Updated';
    case 'delete': return 'Deleted';
  }
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({
  items,
  title = 'Activity Feed',
  maxItems = 10,
  showTrend = true,
}) => {
  const displayItems = items.slice(0, maxItems);
  const trend = useMemo(() => calculateTrend(items), [items]);

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">{title}</Typography>
          {showTrend && trend.direction !== 'flat' && (
            <Chip
              icon={trend.direction === 'up' ? <TrendingUpIcon /> : <TrendingDownIcon />}
              label={`${trend.percentage}% ${trend.direction === 'up' ? 'increase' : 'decrease'}`}
              color={trend.direction === 'up' ? 'success' : 'error'}
              size="small"
              variant="outlined"
            />
          )}
        </Box>

        {displayItems.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            No recent activity
          </Typography>
        ) : (
          displayItems.map((item, index) => (
            <React.Fragment key={item.id}>
              <Box display="flex" gap={2} py={1.5} alignItems="flex-start">
                <Avatar
                  sx={{
                    width: 36,
                    height: 36,
                    bgcolor: `${getTypeColor(item.type)}.light`,
                    color: `${getTypeColor(item.type)}.dark`,
                    fontSize: 14,
                  }}
                >
                  {item.clientName.charAt(0).toUpperCase()}
                </Avatar>
                <Box flex={1} minWidth={0}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" gap={1}>
                    <Typography variant="subtitle2" noWrap>
                      {item.clientName}
                    </Typography>
                    <Chip
                      label={getTypeLabel(item.type)}
                      color={getTypeColor(item.type)}
                      size="small"
                      sx={{ height: 20, fontSize: 11 }}
                    />
                  </Box>
                  <Box display="flex" alignItems="center" gap={0.5} mt={0.25}>
                    <AccessTimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      {item.hours}h &middot; {formatRelativeDate(item.date)}
                    </Typography>
                  </Box>
                  {item.description && (
                    <Box
                      mt={0.5}
                      sx={{
                        '& p': { margin: 0, fontSize: '0.8125rem', color: 'text.secondary' },
                        '& a': { color: 'primary.main' },
                        '& code': {
                          backgroundColor: 'grey.100',
                          padding: '1px 4px',
                          borderRadius: 1,
                          fontSize: '0.75rem',
                        },
                      }}
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdownDescription(item.description),
                      }}
                    />
                  )}
                </Box>
              </Box>
              {index < displayItems.length - 1 && <Divider />}
            </React.Fragment>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityFeed;
