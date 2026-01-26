
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import Constants from 'expo-constants';
import { colors } from '@/styles/commonStyles';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';

interface SearchCoin {
  id: string;
  title: string;
  country: string;
  year: number;
  unit?: string;
  organization?: string;
  agency?: string;
  deployment?: string;
  manufacturer?: string;
  condition?: string;
  imageUrl?: string;
  user: {
    id: string;
    username: string;
    displayName: string;
  };
  likeCount: number;
  openToTrade: boolean;
}

const API_URL = Constants.expoConfig?.extra?.backendUrl || 'http://localhost:3000';

export default function SearchCoinsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [coins, setCoins] = useState<SearchCoin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [countryFilter, setCountryFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [agencyFilter, setAgencyFilter] = useState('');
  const [deploymentFilter, setDeploymentFilter] = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState('');
  const [openToTradeOnly, setOpenToTradeOnly] = useState(false);

  const searchCoins = useCallback(async () => {
    setLoading(true);
    setError(null);
    console.log('SearchCoinsScreen: Searching coins with filters');

    try {
      const params = new URLSearchParams();
      
      if (searchQuery.trim()) {
        params.append('q', searchQuery.trim());
      }
      if (countryFilter.trim()) {
        params.append('country', countryFilter.trim());
      }
      if (unitFilter.trim()) {
        params.append('unit', unitFilter.trim());
      }
      if (agencyFilter.trim()) {
        params.append('agency', agencyFilter.trim());
      }
      if (deploymentFilter.trim()) {
        params.append('deployment', deploymentFilter.trim());
      }
      if (manufacturerFilter.trim()) {
        params.append('manufacturer', manufacturerFilter.trim());
      }
      if (openToTradeOnly) {
        params.append('openToTrade', 'true');
      }

      const url = `${API_URL}/api/search/coins?${params.toString()}`;
      console.log('SearchCoinsScreen: Fetching from:', url);

      const response = await fetch(url);
      console.log('SearchCoinsScreen: Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('SearchCoinsScreen: Found', data.length, 'coins');
        setCoins(data);
      } else {
        const errorText = await response.text();
        console.error('SearchCoinsScreen: Search failed:', errorText);
        setError('Failed to search coins');
        setCoins([]);
      }
    } catch (err: any) {
      console.error('SearchCoinsScreen: Error searching coins:', err);
      setError(err.message || 'Failed to search coins');
      setCoins([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, countryFilter, unitFilter, agencyFilter, deploymentFilter, manufacturerFilter, openToTradeOnly]);

  const handleSearch = () => {
    console.log('SearchCoinsScreen: User initiated search');
    searchCoins();
  };

  const handleClearFilters = () => {
    console.log('SearchCoinsScreen: Clearing all filters');
    setSearchQuery('');
    setCountryFilter('');
    setUnitFilter('');
    setAgencyFilter('');
    setDeploymentFilter('');
    setManufacturerFilter('');
    setOpenToTradeOnly(false);
    setCoins([]);
    setError(null);
  };

  const handleCoinPress = (coinId: string) => {
    console.log('SearchCoinsScreen: Navigating to coin:', coinId);
    router.push(`/coin-detail?id=${coinId}`);
  };

  const renderCoinCard = ({ item }: { item: SearchCoin }) => {
    const agencyText = item.agency || '';
    const unitText = item.unit || '';
    const titleText = item.title || '';
    
    return (
      <TouchableOpacity
        style={styles.coinCard}
        onPress={() => handleCoinPress(item.id)}
        activeOpacity={0.7}
      >
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.coinImage} />
        ) : (
          <View style={[styles.coinImage, styles.imagePlaceholder]}>
            <IconSymbol
              ios_icon_name="photo"
              android_material_icon_name="image"
              size={40}
              color={colors.textSecondary}
            />
          </View>
        )}
        
        <View style={styles.coinInfo}>
          <Text style={styles.coinTitle} numberOfLines={1}>
            {titleText}
          </Text>
          
          <View style={styles.coinMetaRow}>
            {agencyText ? (
              <Text style={styles.coinMeta} numberOfLines={1}>
                {agencyText}
              </Text>
            ) : null}
            {agencyText && unitText ? (
              <Text style={styles.coinMetaSeparator}>•</Text>
            ) : null}
            {unitText ? (
              <Text style={styles.coinMeta} numberOfLines={1}>
                {unitText}
              </Text>
            ) : null}
          </View>
          
          <Text style={styles.coinCountry} numberOfLines={1}>
            {item.country}
          </Text>
          
          <View style={styles.coinFooter}>
            <Text style={styles.coinOwner} numberOfLines={1}>
              @{item.user.username}
            </Text>
            {item.openToTrade && (
              <View style={styles.tradeBadge}>
                <Text style={styles.tradeBadgeText}>Open to Trade</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }

    const hasFilters = searchQuery.trim() || countryFilter.trim() || unitFilter.trim() || 
                       agencyFilter.trim() || deploymentFilter.trim() || manufacturerFilter.trim() || openToTradeOnly;

    if (!hasFilters) {
      return (
        <View style={styles.emptyContainer}>
          <IconSymbol
            ios_icon_name="magnifyingglass"
            android_material_icon_name="search"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={styles.emptyTitle}>Search for Coins</Text>
          <Text style={styles.emptyText}>
            Search by title, country, unit, agency, deployment, or manufacturer
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <IconSymbol
          ios_icon_name="tray"
          android_material_icon_name="inbox"
          size={64}
          color={colors.textSecondary}
        />
        <Text style={styles.emptyTitle}>No Coins Found</Text>
        <Text style={styles.emptyText}>
          No coins match your search criteria. Try different filters.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Search Coins',
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <IconSymbol
            ios_icon_name="magnifyingglass"
            android_material_icon_name="search"
            size={20}
            color={colors.textSecondary}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search coins..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <IconSymbol
                ios_icon_name="xmark.circle.fill"
                android_material_icon_name="cancel"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.filterToggle}
          onPress={() => setShowFilters(!showFilters)}
        >
          <IconSymbol
            ios_icon_name="line.3.horizontal.decrease.circle"
            android_material_icon_name="filter-list"
            size={24}
            color={colors.primary}
          />
          <Text style={styles.filterToggleText}>Filters</Text>
        </TouchableOpacity>
      </View>

      {showFilters && (
        <ScrollView style={styles.filtersContainer} horizontal={false}>
          <View style={styles.filterRow}>
            <TextInput
              style={styles.filterInput}
              placeholder="Country"
              placeholderTextColor={colors.textSecondary}
              value={countryFilter}
              onChangeText={setCountryFilter}
            />
            <TextInput
              style={styles.filterInput}
              placeholder="Unit"
              placeholderTextColor={colors.textSecondary}
              value={unitFilter}
              onChangeText={setUnitFilter}
            />
          </View>
          
          <View style={styles.filterRow}>
            <TextInput
              style={styles.filterInput}
              placeholder="Agency"
              placeholderTextColor={colors.textSecondary}
              value={agencyFilter}
              onChangeText={setAgencyFilter}
            />
            <TextInput
              style={styles.filterInput}
              placeholder="Deployment"
              placeholderTextColor={colors.textSecondary}
              value={deploymentFilter}
              onChangeText={setDeploymentFilter}
            />
          </View>
          
          <TextInput
            style={[styles.filterInput, styles.fullWidthInput]}
            placeholder="Manufacturer"
            placeholderTextColor={colors.textSecondary}
            value={manufacturerFilter}
            onChangeText={setManufacturerFilter}
          />
          
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setOpenToTradeOnly(!openToTradeOnly)}
          >
            <View style={[styles.checkbox, openToTradeOnly && styles.checkboxChecked]}>
              {openToTradeOnly && (
                <IconSymbol
                  ios_icon_name="checkmark"
                  android_material_icon_name="check"
                  size={16}
                  color={colors.background}
                />
              )}
            </View>
            <Text style={styles.checkboxLabel}>Open to Trade Only</Text>
          </TouchableOpacity>
          
          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.clearButton} onPress={handleClearFilters}>
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      <FlatList
        data={coins}
        renderItem={renderCoinCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={coins.length === 0 ? { flex: 1 } : { paddingVertical: 8 }}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  filtersContainer: {
    backgroundColor: colors.card,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    maxHeight: 300,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  filterInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fullWidthInput: {
    marginBottom: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    fontSize: 14,
    color: colors.text,
  },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  searchButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
  },
  coinCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  coinImage: {
    width: 100,
    height: 100,
  },
  imagePlaceholder: {
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  coinTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  coinMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  coinMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  coinMetaSeparator: {
    fontSize: 13,
    color: colors.textSecondary,
    marginHorizontal: 6,
  },
  coinCountry: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  coinFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coinOwner: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  tradeBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tradeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
  },
});
