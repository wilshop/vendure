import { MoneyInput } from '@/vdb/components/data-input/index.js';
import { Alert, AlertDescription } from '@/vdb/components/ui/alert.js';
import { Checkbox } from '@/vdb/components/ui/checkbox.js';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/vdb/components/ui/form.js';
import { Input } from '@/vdb/components/ui/input.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/vdb/components/ui/table.js';
import { api } from '@/vdb/graphql/api.js';
import { graphql } from '@/vdb/graphql/graphql.js';
import { useChannel } from '@/vdb/hooks/use-channel.js';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Package } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';
import { OptionGroupConfiguration, optionGroupSchema, OptionGroupsEditor } from './option-groups-editor.js';

const getStockLocationsDocument = graphql(`
    query GetStockLocations($options: StockLocationListOptions) {
        stockLocations(options: $options) {
            items {
                id
                name
            }
            totalItems
        }
    }
`);

type VariantOption = {
    name: string;
    value: string;
    id: string;
};

type GeneratedVariant = {
    id: string;
    name: string;
    values: string[];
    options: VariantOption[];
    enabled: boolean;
    sku: string;
    price: string;
    stock: string;
};

export interface VariantConfiguration {
    optionGroups: Array<{
        name: string;
        values: Array<{
            value: string;
            id: string;
        }>;
    }>;
    variants: Array<{
        enabled: boolean;
        sku: string;
        price: string;
        stock: string;
        options: VariantOption[];
    }>;
}

const variantSchema = z.object({
    enabled: z.boolean().default(true),
    sku: z.string().min(1, { message: 'SKU is required' }),
    price: z.string().refine(val => !isNaN(Number(val)) && Number(val) >= 0, {
        message: 'Price must be a positive number',
    }),
    stock: z.string().refine(val => !isNaN(Number(val)) && parseInt(val, 10) >= 0, {
        message: 'Stock must be a non-negative integer',
    }),
});

const formSchema = z.object({
    optionGroups: z.array(optionGroupSchema),
    variants: z.record(variantSchema),
});

type VariantForm = z.infer<typeof variantSchema>;

interface CreateProductVariantsProps {
    currencyCode?: string;
    onChange?: ({ data }: { data: VariantConfiguration }) => void;
}

export function CreateProductVariants({
    currencyCode = 'USD',
    onChange,
}: Readonly<CreateProductVariantsProps>) {
    const { data: stockLocationsResult } = useQuery({
        queryKey: ['stockLocations'],
        queryFn: () => api.query(getStockLocationsDocument, { options: { take: 100 } }),
    });
    const { activeChannel } = useChannel();
    const stockLocations = stockLocationsResult?.stockLocations.items ?? [];

    const [optionGroups, setOptionGroups] = useState<OptionGroupConfiguration['optionGroups']>([]);

    const form = useForm<{ variants: Record<string, VariantForm> }>({
        resolver: zodResolver(z.object({ variants: z.record(variantSchema) })),
        defaultValues: {
            variants: {},
        },
        mode: 'onChange',
    });

    const { setValue } = form;

    const variants = useMemo(() => generateVariants(optionGroups), [JSON.stringify(optionGroups)]);

    useEffect(() => {
        const subscription = form.watch(value => {
            const formVariants = value?.variants || {};
            const activeVariants: VariantConfiguration['variants'] = [];

            variants.forEach(variant => {
                if (variant && typeof variant === 'object') {
                    const formVariant = formVariants[variant.id];
                    if (formVariant) {
                        activeVariants.push({
                            enabled: formVariant.enabled ?? true,
                            sku: formVariant.sku ?? '',
                            price: formVariant.price ?? '',
                            stock: formVariant.stock ?? '',
                            options: variant.options,
                        });
                    }
                }
            });

            const filteredData: VariantConfiguration = {
                optionGroups,
                variants: activeVariants,
            };

            onChange?.({ data: filteredData });
        });

        return () => subscription.unsubscribe();
    }, [form, onChange, variants, optionGroups]);

    useEffect(() => {
        const currentVariants = form.getValues().variants || {};
        const updatedVariants = { ...currentVariants };

        variants.forEach(variant => {
            if (!updatedVariants[variant.id]) {
                updatedVariants[variant.id] = {
                    enabled: true,
                    sku: '',
                    price: '',
                    stock: '',
                };
            }
        });

        setValue('variants', updatedVariants);
    }, [variants, form, setValue]);

    const isSingleVariant = variants.length === 1;

    return (
        <FormProvider {...form}>
            <div className="flex w-full flex-col space-y-6">
                <div>
                    <OptionGroupsEditor onChange={data => setOptionGroups(data.optionGroups)} />
                </div>

                {stockLocations.length === 0 ? (
                    <Alert variant="destructive">
                        <AlertDescription>
                            <Trans>No stock locations available on current channel</Trans>
                        </AlertDescription>
                    </Alert>
                ) : (
                    <>
                        {stockLocations.length > 1 && (
                            <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4">
                                <FormLabel className="flex items-center gap-2 text-foreground">
                                    <MapPin className="h-4 w-4" />
                                    <Trans>Add Stock to Location</Trans>
                                </FormLabel>
                                <div className="relative">
                                    <select className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                        {stockLocations.map(location => (
                                            <option key={location.id} value={location.id}>
                                                {location.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {variants.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                    <h3 className="text-sm font-medium text-foreground">
                                        {isSingleVariant ? (
                                            <Trans>Default Variant</Trans>
                                        ) : (
                                            <>
                                                <Trans>Generated Variants</Trans> ({variants.length})
                                            </>
                                        )}
                                    </h3>
                                </div>

                                {/* FIX: Use Grid to contain the Table overflow */}
                                {/* grid-cols-1 forces the children to fit within the grid track, enabling overflow to work */}
                                <div className="grid w-full grid-cols-1 rounded-md border border-border">
                                    {/* Height constraint wrapper */}
                                    <div className="max-h-[400px] w-full overflow-y-auto">
                                        {/* The Table component already has a wrapper with `w-full overflow-auto`.
                                            The grid parent above ensures that `w-full` resolves to the modal width,
                                            not the content width. */}
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    {!isSingleVariant && (
                                                        <TableHead className="w-[50px] whitespace-nowrap text-center">
                                                            <Trans>On</Trans>
                                                        </TableHead>
                                                    )}
                                                    {!isSingleVariant && (
                                                        <TableHead className="min-w-[150px] whitespace-nowrap">
                                                            <Trans>Variant</Trans>
                                                        </TableHead>
                                                    )}
                                                    {/* We enforce min-w here to ensure the table WANTS to be wide */}
                                                    <TableHead className="min-w-[140px]">
                                                        <Trans>SKU</Trans>
                                                    </TableHead>
                                                    <TableHead className="min-w-[140px]">
                                                        <Trans>Price</Trans>
                                                    </TableHead>
                                                    <TableHead className="min-w-[100px]">
                                                        <Trans>Stock</Trans>
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {variants.map(variant => (
                                                    <TableRow key={variant.id} className="hover:bg-muted/30">
                                                        {!isSingleVariant && (
                                                            <TableCell className="text-center">
                                                                <FormField
                                                                    control={form.control}
                                                                    name={`variants.${variant.id}.enabled`}
                                                                    render={({ field }) => (
                                                                        <FormItem className="flex items-center justify-center space-y-0">
                                                                            <FormControl>
                                                                                <Checkbox
                                                                                    checked={field.value}
                                                                                    onCheckedChange={
                                                                                        field.onChange
                                                                                    }
                                                                                />
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            </TableCell>
                                                        )}

                                                        {!isSingleVariant && (
                                                            <TableCell className="whitespace-nowrap font-medium text-sm">
                                                                {variant.values.join(' / ')}
                                                            </TableCell>
                                                        )}

                                                        <TableCell>
                                                            <FormField
                                                                control={form.control}
                                                                name={`variants.${variant.id}.sku`}
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormControl>
                                                                            <Input
                                                                                {...field}
                                                                                placeholder="SKU-123"
                                                                                // min-w forces the input to be usable, triggering scroll if needed
                                                                                className="h-9 w-full min-w-[120px]"
                                                                            />
                                                                        </FormControl>
                                                                        <FormMessage className="text-[10px]" />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </TableCell>

                                                        <TableCell>
                                                            <FormField
                                                                control={form.control}
                                                                name={`variants.${variant.id}.price`}
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormControl>
                                                                            <MoneyInput
                                                                                {...field}
                                                                                value={
                                                                                    Number(field.value) || 0
                                                                                }
                                                                                onChange={value =>
                                                                                    field.onChange(
                                                                                        value.toString(),
                                                                                    )
                                                                                }
                                                                                currency={
                                                                                    activeChannel?.defaultCurrencyCode
                                                                                }
                                                                                className="h-9 w-full min-w-[120px]"
                                                                            />
                                                                        </FormControl>
                                                                        <FormMessage className="text-[10px]" />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </TableCell>

                                                        <TableCell>
                                                            <FormField
                                                                control={form.control}
                                                                name={`variants.${variant.id}.stock`}
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormControl>
                                                                            <Input
                                                                                {...field}
                                                                                type="number"
                                                                                min="0"
                                                                                step="1"
                                                                                className="h-9 w-full min-w-[80px]"
                                                                                placeholder="0"
                                                                            />
                                                                        </FormControl>
                                                                        <FormMessage className="text-[10px]" />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </FormProvider>
    );
}

function generateVariants(groups: OptionGroupConfiguration['optionGroups']): GeneratedVariant[] {
    if (!groups.length)
        return [
            {
                id: 'default',
                name: '',
                values: [],
                options: [],
                enabled: true,
                sku: '',
                price: '',
                stock: '',
            },
        ];

    const validGroups = groups.filter(group => group.name && group.values && group.values.length > 0);
    if (!validGroups.length)
        return [
            {
                id: 'default',
                name: '',
                values: [],
                options: [],
                enabled: true,
                sku: '',
                price: '',
                stock: '',
            },
        ];

    const generateCombinations = (
        optionGroups: OptionGroupConfiguration['optionGroups'],
        currentIndex: number,
        currentCombination: VariantOption[],
    ): GeneratedVariant[] => {
        if (currentIndex === optionGroups.length) {
            return [
                {
                    id: currentCombination.map(c => c.id).join('-'),
                    name: currentCombination.map(c => c.value).join(' '),
                    values: currentCombination.map(c => c.value),
                    options: currentCombination,
                    enabled: true,
                    sku: '',
                    price: '',
                    stock: '',
                },
            ];
        }

        const currentGroup = optionGroups[currentIndex];
        const results: GeneratedVariant[] = [];

        currentGroup.values.forEach(optionValue => {
            const newCombination = [
                ...currentCombination,
                { name: currentGroup.name, value: optionValue.value, id: optionValue.id },
            ];

            const subResults = generateCombinations(optionGroups, currentIndex + 1, newCombination);
            results.push(...subResults);
        });

        return results;
    };

    return generateCombinations(validGroups, 0, []);
}
