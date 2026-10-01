import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CoordinateHelper, MapService, MousePositionToolConfigModel, MousePositionToolModel, ToolTypeEnum } from '@tailormap-viewer/map';
import { combineLatest, map, Observable, of, Subject, switchMap, takeUntil } from 'rxjs';
import {
  BaseComponentTypeEnum,
  MOUSE_COORDINATES_MAP_PROJECTION,
  MouseCoordinatesConfigModel,
  MouseCoordinatesDisplayConfigModel,
  MouseCoordinatesFormat,
} from '@tailormap-viewer/api';
import { AsyncPipe } from '@angular/common';
import { Store } from '@ngrx/store';
import { ComponentConfigHelper } from '../../../shared/helpers/component-config.helper';

interface MouseCoordinatesDisplayValue {
  id: string;
  label: string;
  coordinates: [string, string];
}

@Component({
  selector: 'tm-mouse-coordinates',
  templateUrl: './mouse-coordinates.component.html',
  styleUrls: ['./mouse-coordinates.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe],
})
export class MouseCoordinatesComponent implements OnInit, OnDestroy {
  private mapService = inject(MapService);
  private store$ = inject(Store);

  private destroyed = new Subject();
  public coordinates$: Observable<MouseCoordinatesDisplayValue[]> = of([]);
  private overCoordinatesElement = false;

  public ngOnInit(): void {
    const mouseMove$ = this.mapService.createTool$<MousePositionToolModel, MousePositionToolConfigModel>({
      type: ToolTypeEnum.MousePosition,
      alwaysEnabled: true,
      owner: BaseComponentTypeEnum.MOUSE_COORDINATES,
    }).pipe(switchMap(({ tool }) => tool.mouseMove$));

    const config$ = ComponentConfigHelper.componentConfig$<MouseCoordinatesConfigModel>(
      this.store$,
      BaseComponentTypeEnum.MOUSE_COORDINATES,
    );

    this.coordinates$ = combineLatest([
      mouseMove$,
      config$,
      this.mapService.getProjectionCode$(),
    ])
      .pipe(
        takeUntil(this.destroyed),
        switchMap(([ mouseMove, config, mapProjection ]) => {
          if (mouseMove.type === 'out' && !this.overCoordinatesElement) {
            return of([]);
          }

          if (!config.displays?.length) {
            return this.getDefaultCoordinates$(mouseMove.mapCoordinates);
          }

          const configuredCoordinates = this.getConfiguredCoordinates(
            mouseMove.mapCoordinates,
            config.displays,
            mapProjection,
          );

          return configuredCoordinates.length > 0
            ? of(configuredCoordinates)
            : this.getDefaultCoordinates$(mouseMove.mapCoordinates);
        }),
      );
  }

  public ngOnDestroy() {
    this.destroyed.next(null);
    this.destroyed.complete();
  }

  public isOverCoordinates(isOverCoordinates: boolean) {
    this.overCoordinatesElement = isOverCoordinates;
  }

  private getDefaultCoordinates$(coordinates: [number, number]): Observable<MouseCoordinatesDisplayValue[]> {
    return this.mapService.getRoundedCoordinates$(coordinates)
      .pipe(
        map(roundedCoordinates => [{
          id: 'map',
          label: '',
          coordinates: [ roundedCoordinates[0] || '', roundedCoordinates[1] || '' ],
        }]),
      );
  }

  private getConfiguredCoordinates(
    mapCoordinates: [number, number],
    displays: MouseCoordinatesDisplayConfigModel[],
    mapProjection: string,
  ): MouseCoordinatesDisplayValue[] {
    return displays.flatMap((display, index) => {
      const targetProjection = display.projection === MOUSE_COORDINATES_MAP_PROJECTION
        ? mapProjection
        : display.projection;

      try {
        const projectedCoordinates = targetProjection === mapProjection
          ? mapCoordinates
          : CoordinateHelper.projectCoordinates(mapCoordinates, mapProjection, targetProjection);

        return [{
          id: display.id || `coordinate-display-${index}`,
          label: display.label?.trim() || this.getDisplayLabel(targetProjection, display.format),
          coordinates: CoordinateHelper.formatCoordinates(projectedCoordinates, targetProjection, display.format),
        }];
      } catch {
        return [];
      }
    });
  }

  private getDisplayLabel(projection: string, format: MouseCoordinatesFormat): string {
    switch (format) {
      case 'decimal-degrees':
        return `${projection} DD`;
      case 'degrees-decimal-minutes':
        return `${projection} DDM`;
      default:
        return projection;
    }
  }
}
