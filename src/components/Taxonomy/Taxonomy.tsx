import React, { useState, useCallback, useEffect, useRef, useMemo, useContext, FormEvent } from "react";

import { useToggle } from "../../hooks/useToggle";
import { isArraysEqual } from "../../utils/utilities";

import styles from "./Taxonomy.module.scss";

type TaxonomyPath = string[]

type TaxonomyItem = {
  label: string,
  path: TaxonomyPath,
  depth: number,
  children?: TaxonomyItem[],
}

type TaxonomyOptions = {
  leafsOnly?: boolean,
  showFullPath?: boolean,
  pathSeparator?: string,
  maxUsages?: number,
}

type TaxonomyOptionsContextValue = TaxonomyOptions & {
  maxUsagesReached?: boolean
}

type TaxonomyProps = {
  items: TaxonomyItem[],
  selected: TaxonomyPath[],
  onChange: (node: any, selected: TaxonomyPath[]) => any,
  options?: TaxonomyOptions,
}

type TaxonomySelectedContextValue = [
  TaxonomyPath[],
  (path: TaxonomyPath, value: boolean) => any,
]

const TaxonomySelectedContext = React.createContext<TaxonomySelectedContextValue>([[], () => undefined]);
const TaxonomyOptionsContext = React.createContext<TaxonomyOptionsContextValue>({});

const SelectedList = () => {
  const [selected, setSelected] = useContext(TaxonomySelectedContext);
  const { showFullPath, pathSeparator = " / " } = useContext(TaxonomyOptionsContext);

  return (
    <div className={styles.taxonomy__selected}>
      {selected.map(path => (
        <div key={path.join("|")}>
          {showFullPath ? path.join(pathSeparator) : path[path.length - 1]}
          <input type="button" onClick={() => setSelected(path, false)} value="×" />
        </div>
      ))}
    </div>
  );
};

const Item = ({ item, flat = false }: { item: TaxonomyItem, flat?: boolean }) => {
  const [selected, setSelected] = useContext(TaxonomySelectedContext);
  const { leafsOnly, maxUsages, maxUsagesReached } = useContext(TaxonomyOptionsContext);
  const [isOpen, , , toggle] = useToggle();
  const prefix = item.children?.length && !flat ? (isOpen ? "-" : "+") : " ";
  const onClick = () => leafsOnly && toggle();

  const checked = selected.some(current => isArraysEqual(current, item.path));
  const hasChilds = Boolean(item.children?.length);
  const onlyLeafsAllowed = leafsOnly && hasChilds;
  const limitReached = maxUsagesReached && !checked;
  const title = onlyLeafsAllowed
    ? "Only leaf nodes allowed"
    : (limitReached ? `Maximum ${maxUsages} items already selected` : "");

  return (
    <div>
      <div className={styles.taxonomy__item}>
        <div className={styles.taxonomy__grouping} onClick={toggle}>{prefix}</div>
        <label onClick={onClick} title={title}>
          <input
            type="checkbox"
            disabled={onlyLeafsAllowed || limitReached}
            checked={checked}
            onChange={e => setSelected(item.path, e.currentTarget.checked)}
          />
          {item.label}
        </label>
      </div>
      {item.children && !flat && isOpen && item.children.map(
        child => <Item key={child.label} item={child}/>,
      )}
    </div>
  );
};

type DropdownProps = {
  dropdownRef: React.Ref<HTMLDivElement>,
  flatten: TaxonomyItem[],
  items: TaxonomyItem[],
  show: boolean,
}

const Dropdown = ({ show, flatten, items, dropdownRef }: DropdownProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const predicate = (item: TaxonomyItem) => item.label.toLocaleLowerCase().includes(search);
  const list = search ? flatten.filter(predicate) : items;
  const onInput = (e: FormEvent<HTMLInputElement>) => setSearch(e.currentTarget.value.toLocaleLowerCase());

  useEffect(() => {
    const input = inputRef.current;

    if (show && input) {
      input.value = "";
      input.focus();
      setSearch("");
    }
  }, [show]);

  return (
    <div className={styles.taxonomy__dropdown} ref={dropdownRef} style={{ display: show ? "block" : "none" }}>
      <input
        className={styles.taxonomy__search}
        name="taxonomy__search"
        placeholder="Search..."
        onInput={onInput}
        ref={inputRef}
      />
      {list.map(item => <Item key={item.label} item={item} flat={search !== ""} />)}
    </div>
  );
};

const Taxonomy = ({ items, selected: externalSelected, onChange, options = {} }: TaxonomyProps) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const onClickOutside = useCallback(e => {
    if (!dropdownRef.current?.contains(e.target)) close();
  }, []);
  const onEsc = useCallback(e => {
    if (e.key === "Escape") {
      close();
      e.stopPropagation();
    }
  }, []);

  const flatten = useMemo(() => {
    const flatten: TaxonomyItem[] = [];
    const visitItem = (item: TaxonomyItem) => {
      flatten.push(item);
      item.children?.forEach(visitItem);
    };

    items.forEach(visitItem);
    return flatten;
  }, [items]);

  const [selected, setInternalSelected] = useState(externalSelected);
  const contextValue: TaxonomySelectedContextValue = useMemo(() => {
    const setSelected = (path: TaxonomyPath, value: boolean) => {
      const newSelected = value
        ? [...selected, path]
        : selected.filter(current => !isArraysEqual(current, path));

      setInternalSelected(newSelected);
      onChange && onChange(null, newSelected);
    };

    return [selected, setSelected];
  }, [selected]);

  const optionsWithMaxUsages = useMemo(() => {
    const maxUsagesReached = options.maxUsages ? selected.length >= options.maxUsages : false;

    return { ...options, maxUsagesReached };
  }, [options, options.maxUsages, options.maxUsages ? selected : 0]);

  useEffect(() => {
    setInternalSelected(externalSelected);
  }, [externalSelected]);

  useEffect(() => {
    if (isOpen) {
      document.body.addEventListener("click", onClickOutside, true);
      document.body.addEventListener("keydown", onEsc, true);
    } else {
      document.body.removeEventListener("click", onClickOutside);
      document.body.removeEventListener("keydown", onEsc);
    }
  }, [isOpen]);

  return (
    <TaxonomySelectedContext.Provider value={contextValue}>
      <TaxonomyOptionsContext.Provider value={optionsWithMaxUsages}>
        <div className={styles.taxonomy}>
          <SelectedList />
          <span onClick={() => !isOpen && setOpen(true)}>Click to add...</span>
          <Dropdown show={isOpen} items={items} flatten={flatten} dropdownRef={dropdownRef} />
        </div>
      </TaxonomyOptionsContext.Provider>
    </TaxonomySelectedContext.Provider>
  );
};

export { Taxonomy };
